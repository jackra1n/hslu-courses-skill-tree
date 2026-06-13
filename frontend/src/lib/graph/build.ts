import type { Node, Edge } from '@xyflow/svelte';
import type { ExtendedNodeData, Course, TemplateSlot, PrerequisiteRule } from '$lib/types';
import type { StudyPlan, PlanNode } from '$lib/data/study-plan';
import { resolveCourse, buildPlanRowIndex, mapPlanCourseProviders } from '$lib/data/study-plan';
import { getNodeWidth, getNodeLabel } from './layout';
import { MarkerType } from '@xyflow/svelte';
import { hasPlanPrereqConflict } from '$lib/utils/prerequisite';

type HandleUsage = Record<string, { source: number; target: number }>;

// Cap on source/target handles per node, to avoid crowding the connector edge.
const MAX_HANDLES = 7;

export function toGraph(plan: StudyPlan, showShortNamesOnly: boolean): { nodes: Node[]; edges: Edge[] } {
  const courseProviders = mapPlanCourseProviders(plan);
  const rowIndex = buildPlanRowIndex(plan);
  const retakes = mapRetakes(courseProviders, rowIndex);

  const nodes = Object.values(plan.nodes).map((planNode) =>
    buildNode(planNode, plan, showShortNamesOnly, retakes.has(planNode.id))
  );

  const { edges, usage } = buildEdges(plan, courseProviders, rowIndex, retakes);
  applyHandleUsage(nodes, usage);

  return { nodes, edges };
}

// Maps each retake (a course instance that isn't the first) to the attempt
// directly before it. A course only repeats after an earlier failed attempt.
function mapRetakes(
  courseProviders: Map<string, string[]>,
  rowIndex: Record<string, number>
): Map<string, string> {
  const retakes = new Map<string, string>();
  courseProviders.forEach((nodeIds) => {
    if (nodeIds.length < 2) return;
    const ordered = [...nodeIds].sort((a, b) => (rowIndex[a] ?? Infinity) - (rowIndex[b] ?? Infinity));
    for (let i = 1; i < ordered.length; i++) {
      retakes.set(ordered[i], ordered[i - 1]);
    }
  });
  return retakes;
}

function calculateTargetHandles(course: Course | null): number {
  if (!course || !course.prerequisites || course.prerequisites.length === 0) {
    return 0;
  }

  // OR within a rule needs 1 handle (any module satisfies); AND needs one per module.
  const handlesPerRule = course.prerequisites.map((rule) =>
    rule.moduleLinkType === 'oder' ? 1 : rule.modules.length
  );

  // OR between rules shows only one rule (the widest); AND shows them all.
  const prerequisiteLinkType = course.prerequisites[0].prerequisiteLinkType || 'und';
  return prerequisiteLinkType === 'oder'
    ? Math.max(...handlesPerRule)
    : handlesPerRule.reduce((sum, handles) => sum + handles, 0);
}

function buildNode(planNode: PlanNode, plan: StudyPlan, showShortNamesOnly: boolean, isRetake: boolean): Node {
  const course = resolveCourse(planNode.courseId) ?? null;
  const slot = toSlotSnapshot(planNode);
  const isElectiveSlot = slot.type === 'elective' || slot.type === 'major';
  const label = course ? getNodeLabel(course, showShortNamesOnly) : getFallbackLabel(slot.type);
  const ects = course?.ects ?? 3;
  // A retake only receives the single arrow from its previous attempt.
  const targetHandles = isRetake ? 1 : Math.min(calculateTargetHandles(course), MAX_HANDLES);

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
      hasLaterPrerequisites: hasPlanPrereqConflict(plan, planNode.id),
      targetHandles
    } as ExtendedNodeData,
    style: ''
  };

  return node;
}

function toSlotSnapshot(planNode: PlanNode): TemplateSlot {
  const type = planNode.slotType === 'custom' ? 'elective' : planNode.slotType;
  return {
    id: planNode.id,
    type,
    semester: planNode.semester,
    courseId: planNode.baseCourseId
  };
}

function getFallbackLabel(slotType: TemplateSlot['type']): string {
  if (slotType === 'elective') return 'Wahl-Modul';
  if (slotType === 'major') return 'Major-Modul';
  return 'Course';
}

// The provider node sitting in the earliest semester row, or undefined if none.
function earliestByRow(ids: string[], rowIndex: Record<string, number>): string | undefined {
  if (ids.length === 0) return undefined;
  return ids.reduce((best, current) =>
    (rowIndex[current] ?? Infinity) < (rowIndex[best] ?? Infinity) ? current : best
  );
}

export function selectProviderForRule(
  rule: PrerequisiteRule,
  courseProviders: Map<string, string[]>,
  rowIndex: Record<string, number>
): string[] {
  if (rule.moduleLinkType === 'oder') {
    // any one module satisfies the rule: pick the single earliest provider
    const allProviders = rule.modules.flatMap((moduleId) => courseProviders.get(moduleId) ?? []);
    const earliest = earliestByRow(allProviders, rowIndex);
    return earliest ? [earliest] : [];
  }

  // every module required: pick the earliest provider of each
  return rule.modules.flatMap((moduleId) => {
    const earliest = earliestByRow(courseProviders.get(moduleId) ?? [], rowIndex);
    return earliest ? [earliest] : [];
  });
}

// Which prerequisite rules get edges drawn. OR-linked rules show only the one
// whose providers appear earliest; AND-linked rules all show.
function selectRulesToProcess(
  course: Course,
  courseProviders: Map<string, string[]>,
  rowIndex: Record<string, number>
): PrerequisiteRule[] {
  const rules = course.prerequisites;
  if (rules.length <= 1) return rules;
  if ((rules[0].prerequisiteLinkType || 'und') !== 'oder') return rules;

  const ruleRows = rules.map((rule) => {
    const providers = selectProviderForRule(rule, courseProviders, rowIndex);
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
  retakes: Map<string, string>
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
      type: 'bezier'
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

    selectRulesToProcess(course, courseProviders, rowIndex).forEach((rule) => {
      selectProviderForRule(rule, courseProviders, rowIndex).forEach((providerId) => {
        addEdge(providerId, planNode.id);
      });
    });
  });

  return { edges, usage };
}

function applyHandleUsage(nodes: Node[], usage: HandleUsage): void {
  nodes.forEach((node) => {
    const nodeUsage = usage[node.id];
    if (!nodeUsage) return;
    node.data = {
      ...(node.data as ExtendedNodeData),
      sourceHandles: Math.min(nodeUsage.source, MAX_HANDLES)
      // targetHandles are set in buildNode from the course prerequisites
    };
  });
}
