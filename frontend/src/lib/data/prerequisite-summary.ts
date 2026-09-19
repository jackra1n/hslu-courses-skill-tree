import { evaluatePrerequisiteRule } from '$lib/utils/prerequisite';
import type { PrerequisiteRule } from './catalog-types';
import { buildPlanRowIndex, type StudyPlan } from './study-plan';

export type PrerequisiteCourseSummary = {
	courseId: string;
	state:
		| 'required'
		| 'completed'
		| 'attended'
		| 'planned'
		| 'missing'
		| 'later'
		| 'incomplete';
	semesters: number[];
};

export type PrerequisiteRuleSummary = {
	ruleIndex: number;
	state:
		| 'required'
		| 'satisfied'
		| 'planned'
		| 'missing'
		| 'later'
		| 'incomplete';
	relevant: boolean;
	courses: PrerequisiteCourseSummary[];
};

type CourseProgress = {
	completed: boolean;
	attended: boolean;
	hasSuitableInstance: boolean;
	semesters: number[];
};

function branchQuality(summary: PrerequisiteRuleSummary): number {
	if (summary.state === 'satisfied') return 2;
	if (summary.state === 'planned') return 1;
	return 0;
}

function markRelevantBranches(
	rules: readonly PrerequisiteRule[],
	summaries: PrerequisiteRuleSummary[],
): void {
	if (summaries.length === 0) return;

	// prefixes represent the evaluator's left-to-right expression, not AND precedence.
	const prefixQuality = [branchQuality(summaries[0])];
	for (let index = 1; index < summaries.length; index++) {
		const previous = prefixQuality[index - 1];
		const current = branchQuality(summaries[index]);
		prefixQuality.push(
			rules[index - 1].prerequisiteLinkType === 'oder'
				? Math.max(previous, current)
				: Math.min(previous, current),
		);
	}

	let prefixRelevant = true;
	for (let index = summaries.length - 1; index > 0; index--) {
		if (!prefixRelevant) break;
		if (rules[index - 1].prerequisiteLinkType === 'oder') {
			const preferred = prefixQuality[index];
			summaries[index].relevant = branchQuality(summaries[index]) === preferred;
			prefixRelevant = prefixQuality[index - 1] === preferred;
		} else {
			// an AND branch must retain its missing requirements, even if its sibling is met.
			summaries[index].relevant = true;
		}
	}
	summaries[0].relevant = prefixRelevant;
}

export function summarizePrerequisites(
	rules: readonly PrerequisiteRule[],
	plan: StudyPlan | null,
	slotStatus: Map<string, 'attended' | 'completed'>,
	targetNodeId?: string,
): PrerequisiteRuleSummary[] {
	const coursesInPlan = new Map<string, CourseProgress>();
	if (plan) {
		const rowIndex = buildPlanRowIndex(plan);
		const targetRow = targetNodeId ? rowIndex[targetNodeId] : undefined;
		for (const node of Object.values(plan.nodes)) {
			if (!node.courseId) continue;
			let progress = coursesInPlan.get(node.courseId);
			if (!progress) {
				progress = {
					completed: false,
					attended: false,
					hasSuitableInstance: false,
					semesters: [],
				};
				coursesInPlan.set(node.courseId, progress);
			}
			const status = slotStatus.get(node.id);
			progress.completed ||= status === 'completed';
			progress.attended ||= status === 'attended';
			const courseRow = rowIndex[node.id];
			progress.hasSuitableInstance ||=
				targetRow === undefined ||
				courseRow === undefined ||
				courseRow <= targetRow;
			if (!progress.semesters.includes(node.semester)) {
				progress.semesters.push(node.semester);
			}
		}
		for (const progress of coursesInPlan.values()) {
			progress.semesters.sort((left, right) => left - right);
		}
	}

	if (!plan || coursesInPlan.size === 0) {
		return rules.map((rule, ruleIndex) => ({
			ruleIndex,
			state: 'required',
			relevant: true,
			courses: rule.modules.map((courseId) => ({
				courseId,
				state: 'required',
				semesters: [],
			})),
		}));
	}

	const summaries = rules.map((rule, ruleIndex): PrerequisiteRuleSummary => {
		let courses = rule.modules.map((courseId): PrerequisiteCourseSummary => {
			const progress = coursesInPlan.get(courseId);
			let state: PrerequisiteCourseSummary['state'];
			if (!progress) state = 'missing';
			else if (progress.completed) state = 'completed';
			else if (progress.attended) {
				state = rule.mustBePassed ? 'incomplete' : 'attended';
			} else {
				state = progress.hasSuitableInstance ? 'planned' : 'later';
			}
			return { courseId, state, semesters: progress?.semesters ?? [] };
		});
		const satisfied = evaluatePrerequisiteRule(rule, slotStatus, plan);
		const isAlternative = rule.moduleLinkType === 'oder';
		if (isAlternative) {
			const candidates = courses.filter((course) =>
				satisfied
					? course.state === 'completed' || course.state === 'attended'
					: course.state !== 'missing',
			);
			if (candidates.length > 0) courses = candidates;
		}

		let state: PrerequisiteRuleSummary['state'];
		if (satisfied) state = 'satisfied';
		else if (isAlternative) {
			if (courses.some((course) => course.state === 'planned'))
				state = 'planned';
			else if (courses.some((course) => course.state === 'incomplete'))
				state = 'incomplete';
			else if (courses.some((course) => course.state === 'later'))
				state = 'later';
			else state = 'missing';
		} else {
			if (courses.some((course) => course.state === 'missing'))
				state = 'missing';
			else if (courses.some((course) => course.state === 'later'))
				state = 'later';
			else if (courses.some((course) => course.state === 'incomplete'))
				state = 'incomplete';
			else state = 'planned';
		}
		return { ruleIndex, state, relevant: false, courses };
	});

	markRelevantBranches(rules, summaries);
	return summaries;
}
