import type { Edge, Node } from '@xyflow/svelte';
import { MarkerType } from '@xyflow/svelte';
import type { PlanNode, StudyPlan } from '$lib/data/planning/study-plan';
import {
	buildPlanRowIndex,
	mapPlanCourseProviders,
	resolveCourse,
} from '$lib/data/planning/study-plan';
import * as m from '$lib/paraglide/messages';
import type {
	Course,
	ExtendedNodeData,
	PrerequisiteRule,
	TemplateSlot,
} from '$lib/types';
import { hasPlanPrereqConflict } from '$lib/utils/prerequisite';
import { getNodeLabel, getNodeWidth } from './layout';

type HandleUsage = Record<string, { source: number; target: number }>;

// Cap on source/target handles per node, to avoid crowding the connector edge.
const MAX_HANDLES = 7;

export function toGraph(
	plan: StudyPlan,
	showShortNamesOnly: boolean,
	slotStatus: ReadonlyMap<string, 'attended' | 'completed'>,
): { nodes: Node[]; edges: Edge[] } {
	const courseProviders = mapPlanCourseProviders(plan);
	const rowIndex = buildPlanRowIndex(plan);
	const retakes = mapRetakes(courseProviders, rowIndex);

	const nodes = Object.values(plan.nodes).map((planNode) =>
		buildNode(
			planNode,
			plan,
			showShortNamesOnly,
			retakes.has(planNode.id),
			slotStatus,
		),
	);

	const { edges, usage } = buildEdges(
		plan,
		courseProviders,
		rowIndex,
		retakes,
		slotStatus,
	);
	applyHandleUsage(nodes, usage);

	return { nodes, edges };
}

// Maps each retake (a course instance that isn't the first) to the attempt
// directly before it. A course only repeats after an earlier failed attempt.
function mapRetakes(
	courseProviders: Map<string, string[]>,
	rowIndex: Record<string, number>,
): Map<string, string> {
	const retakes = new Map<string, string>();
	courseProviders.forEach((nodeIds) => {
		if (nodeIds.length < 2) return;
		const ordered = [...nodeIds].sort(
			(a, b) => (rowIndex[a] ?? Infinity) - (rowIndex[b] ?? Infinity),
		);
		for (let i = 1; i < ordered.length; i++) {
			retakes.set(ordered[i], ordered[i - 1]);
		}
	});
	return retakes;
}

function calculateTargetHandles(course: Course | null): number {
	if (!course?.prerequisites?.length) {
		return 0;
	}

	// OR within a rule needs 1 handle (any module satisfies); AND needs one per module.
	const handlesPerRule = course.prerequisites.map((rule) =>
		rule.moduleLinkType === 'oder' ? 1 : rule.modules.length,
	);

	// OR between rules shows only one rule (the widest); AND shows them all.
	const prerequisiteLinkType =
		course.prerequisites[0].prerequisiteLinkType || 'und';
	return prerequisiteLinkType === 'oder'
		? Math.max(...handlesPerRule)
		: handlesPerRule.reduce((sum, handles) => sum + handles, 0);
}

function buildNode(
	planNode: PlanNode,
	plan: StudyPlan,
	showShortNamesOnly: boolean,
	isRetake: boolean,
	slotStatus: ReadonlyMap<string, 'attended' | 'completed'>,
): Node {
	const course = resolveCourse(planNode.courseId) ?? null;
	const slot = toSlotSnapshot(planNode);
	const isElectiveSlot = slot.type === 'elective' || slot.type === 'major';
	const label = course
		? getNodeLabel(course, showShortNamesOnly)
		: getFallbackLabel(slot.type);
	const ects = course?.ects ?? 3;
	// A retake only receives the single arrow from its previous attempt.
	const targetHandles = isRetake
		? 1
		: Math.min(calculateTargetHandles(course), MAX_HANDLES);

	const node: Node = {
		id: planNode.id,
		position: { x: 0, y: 0 },
		type: 'custom',
		data: {
			label,
			slot,
			course,
			isElectiveSlot,
			width: getNodeWidth(ects),
			hasLaterPrerequisites: hasPlanPrereqConflict(
				plan,
				planNode.id,
				slotStatus,
			),
			targetHandles,
		} as ExtendedNodeData,
		style: '',
	};

	return node;
}

function toSlotSnapshot(planNode: PlanNode): TemplateSlot {
	const type = planNode.slotType === 'custom' ? 'elective' : planNode.slotType;
	return {
		id: planNode.id,
		type,
		semester: planNode.semester,
		courseId: planNode.baseCourseId,
	};
}

function getFallbackLabel(slotType: TemplateSlot['type']): string {
	if (slotType === 'elective') return m.slot_wahl();
	if (slotType === 'major') return m.slot_major();
	return m.slot_course();
}

export function selectProviderForRule(
	rule: PrerequisiteRule,
	courseProviders: Map<string, string[]>,
	rowIndex: Record<string, number>,
	slotStatus: ReadonlyMap<string, 'attended' | 'completed'>,
): string[] {
	const selected: string[] = [];
	const isModuleOr = rule.moduleLinkType === 'oder';
	let best: string | undefined;
	let bestPriority = Infinity;
	let bestRow = Infinity;

	for (const moduleId of rule.modules) {
		for (const providerId of courseProviders.get(moduleId) ?? []) {
			const status = slotStatus.get(providerId);
			const satisfies =
				status === 'completed' || (!rule.mustBePassed && status === 'attended');
			// Prefer a satisfying outcome, then a planned attempt, then a failure.
			const priority = satisfies ? 0 : status === undefined ? 1 : 2;
			const row = rowIndex[providerId] ?? Infinity;
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

// Which prerequisite rules get edges drawn. OR-linked rules show only the one
// whose providers appear earliest; AND-linked rules all show.
function selectRulesToProcess(
	course: Course,
	courseProviders: Map<string, string[]>,
	rowIndex: Record<string, number>,
	slotStatus: ReadonlyMap<string, 'attended' | 'completed'>,
): PrerequisiteRule[] {
	const rules = course.prerequisites;
	if (rules.length <= 1) return rules;
	if ((rules[0].prerequisiteLinkType || 'und') !== 'oder') return rules;

	const ruleRows = rules.map((rule) => {
		const providers = selectProviderForRule(
			rule,
			courseProviders,
			rowIndex,
			slotStatus,
		);
		return providers.length === 0
			? Infinity
			: Math.min(...providers.map((id) => rowIndex[id] ?? Infinity));
	});
	return [rules[ruleRows.indexOf(Math.min(...ruleRows))]];
}

function buildEdges(
	plan: StudyPlan,
	courseProviders: Map<string, string[]>,
	rowIndex: Record<string, number>,
	retakes: Map<string, string>,
	slotStatus: ReadonlyMap<string, 'attended' | 'completed'>,
): { edges: Edge[]; usage: HandleUsage } {
	const edges: Edge[] = [];
	const usage: HandleUsage = {};
	const seen = new Set<string>();

	Object.keys(plan.nodes).forEach((nodeId) => {
		usage[nodeId] = { source: 0, target: 0 };
	});

	const addEdge = (source: string, target: string) => {
		if (source === target) return;
		const edgeId = `${source}=>${target}`;
		if (seen.has(edgeId)) return;
		seen.add(edgeId);

		edges.push({
			id: edgeId,
			source,
			sourceHandle: `source-${usage[source]?.source ?? 0}`,
			target,
			targetHandle: `target-${usage[target]?.target ?? 0}`,
			markerEnd: { type: MarkerType.ArrowClosed },
			animated: false,
			style: 'stroke-width: 2px;',
			type: 'bezier',
		});

		if (usage[source]) usage[source].source++;
		if (usage[target]) usage[target].target++;
	};

	Object.values(plan.nodes).forEach((planNode) => {
		if (!planNode.courseId) return;

		// A retake links only to its previous attempt, not to the course's prerequisites.
		const previousAttempt = retakes.get(planNode.id);
		if (previousAttempt) {
			addEdge(previousAttempt, planNode.id);
			return;
		}

		const course = resolveCourse(planNode.courseId);
		if (!course) return;

		selectRulesToProcess(course, courseProviders, rowIndex, slotStatus).forEach(
			(rule) => {
				selectProviderForRule(
					rule,
					courseProviders,
					rowIndex,
					slotStatus,
				).forEach((providerId) => {
					addEdge(providerId, planNode.id);
				});
			},
		);
	});

	return { edges, usage };
}

function applyHandleUsage(nodes: Node[], usage: HandleUsage): void {
	nodes.forEach((node) => {
		const nodeUsage = usage[node.id];
		if (!nodeUsage) return;
		node.data = {
			...(node.data as ExtendedNodeData),
			sourceHandles: Math.min(nodeUsage.source, MAX_HANDLES),
			// targetHandles are set in buildNode from the course prerequisites
		};
	});
}
