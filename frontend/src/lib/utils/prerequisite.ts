import type { Course, PrerequisiteRule } from '$lib/data/catalog/courses';
import type { StudyPlan } from '$lib/data/planning/study-plan';
import {
	buildPlanRowIndex,
	mapPlanCourseProviders,
	resolveCourse,
} from '$lib/data/planning/study-plan';

type SlotStatus = ReadonlyMap<string, 'attended' | 'completed'>;

export function evaluatePrerequisiteRule(
	rule: PrerequisiteRule,
	slotStatus: SlotStatus,
	plan: StudyPlan,
): boolean {
	const moduleResults = rule.modules.map((moduleId) => {
		const nodeIds = getNodesForCourse(plan, moduleId);
		if (nodeIds.length === 0) return false;
		return nodeIds.some((nodeId) => {
			const status = slotStatus.get(nodeId);
			if (rule.mustBePassed) {
				return status === 'completed';
			}
			return status === 'attended' || status === 'completed';
		});
	});

	if (rule.moduleLinkType === 'oder') {
		return moduleResults.some(Boolean);
	}
	return moduleResults.every(Boolean);
}

export function evaluatePrerequisites(
	rules: PrerequisiteRule[],
	slotStatus: SlotStatus,
	plan: StudyPlan,
): boolean {
	if (rules.length === 0) return true;

	return rules.reduce((acc, rule, index) => {
		const current = evaluatePrerequisiteRule(rule, slotStatus, plan);
		if (index === 0) {
			return current;
		}
		const prevRule = rules[index - 1];
		const linkType = prevRule.prerequisiteLinkType || 'und';
		return linkType === 'oder' ? acc || current : acc && current;
	}, false);
}

// One context per graph build: all prerequisite decisions share the same indexes
// and progress snapshot without depending on the graph renderer or global stores.
export class PlanPrerequisites {
	readonly courseProviders: Map<string, string[]>;
	readonly rowIndex: Record<string, number>;

	constructor(
		private readonly plan: StudyPlan,
		private readonly slotStatus: SlotStatus,
	) {
		this.courseProviders = mapPlanCourseProviders(plan);
		this.rowIndex = buildPlanRowIndex(plan);
	}

	selectProviders(rule: PrerequisiteRule): string[] {
		const selected: string[] = [];
		const isModuleOr = rule.moduleLinkType === 'oder';
		let best: string | undefined;
		let bestPriority = Infinity;
		let bestRow = Infinity;

		for (const moduleId of rule.modules) {
			for (const providerId of this.courseProviders.get(moduleId) ?? []) {
				const status = this.slotStatus.get(providerId);
				const satisfies =
					status === 'completed' ||
					(!rule.mustBePassed && status === 'attended');
				// Prefer a satisfying outcome, then a planned attempt, then a failure.
				const priority = satisfies ? 0 : status === undefined ? 1 : 2;
				const row = this.rowIndex[providerId] ?? Infinity;
				const preferredRow = priority === 2 ? row > bestRow : row < bestRow;
				if (
					best === undefined ||
					priority < bestPriority ||
					(priority === bestPriority && preferredRow)
				) {
					best = providerId;
					bestPriority = priority;
					bestRow = row;
				}
			}

			if (!isModuleOr && best !== undefined) {
				selected.push(best);
				best = undefined;
			}
		}

		if (isModuleOr && best !== undefined) selected.push(best);
		return selected;
	}

	// OR-linked rules use the earliest providers; AND-linked rules all apply.
	selectRules(course: Course): PrerequisiteRule[] {
		const rules = course.prerequisites;
		if (rules.length <= 1) return rules;
		if ((rules[0].prerequisiteLinkType || 'und') !== 'oder') return rules;

		const ruleRows = rules.map((rule) => {
			const providers = this.selectProviders(rule);
			return providers.length === 0
				? Infinity
				: Math.min(...providers.map((id) => this.rowIndex[id] ?? Infinity));
		});
		return [rules[ruleRows.indexOf(Math.min(...ruleRows))]];
	}

	hasConflict(
		targetNodeId: string,
		options?: { considerSameSemester?: boolean },
	): boolean {
		const node = this.plan.nodes[targetNodeId];
		if (!node?.courseId) return false;
		const course = resolveCourse(node.courseId);
		if (!course || course.prerequisites.length === 0) return false;

		const dependentRow = this.rowIndex[targetNodeId] ?? 0;
		const considerSameSemester = options?.considerSameSemester ?? true;

		return this.selectRules(course).some((rule) => {
			const providers = this.selectProviders(rule);
			if (providers.length === 0) return true;

			return providers.some((providerId) => {
				const providerRow = this.rowIndex[providerId] ?? 0;
				return considerSameSemester
					? providerRow >= dependentRow
					: providerRow > dependentRow;
			});
		});
	}
}

function getNodesForCourse(plan: StudyPlan, courseId: string): string[] {
	return Object.values(plan.nodes)
		.filter((node) => node.courseId === courseId)
		.map((node) => node.id);
}
