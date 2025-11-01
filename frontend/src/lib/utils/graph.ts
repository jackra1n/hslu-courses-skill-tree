import type { Node, Edge } from '@xyflow/svelte';
import type { ExtendedNodeData, Course, TemplateSlot, PrerequisiteRule } from '$lib/types';
import type { StudyPlan, PlanNode } from '$lib/data/study-plan';
import { resolveCourse, buildPlanRowIndex, mapPlanCourseProviders } from '$lib/data/study-plan';
import { getNodeWidth, getNodeLabel } from '$lib/utils/layout';
import { MarkerType } from '@xyflow/svelte';
import { hasPlanPrereqConflict } from '$lib/utils/prerequisite';

type HandleUsage = Record<string, { source: number; target: number }>;

export function toGraph(plan: StudyPlan, showShortNamesOnly: boolean): { nodes: Node[]; edges: Edge[] } {
  const rowIndexByNode = buildPlanRowIndex(plan);
  const courseProviders = mapPlanCourseProviders(plan);
  const nodes = Object.values(plan.nodes).map((planNode) =>
    buildNode(planNode, plan, showShortNamesOnly)
  );

  const { edges, usage } = buildEdges(plan, courseProviders);
  applyHandleUsage(nodes, usage);

  return { nodes, edges };
}

function calculateTargetHandles(course: Course | null): number {
  if (!course || !course.prerequisites || course.prerequisites.length === 0) {
    return 0;
  }

  // calculate handles needed for each rule
  const handlesPerRule = course.prerequisites.map((rule) => {
    if (rule.moduleLinkType === 'oder') {
      // OR within rule: only need 1 handle (any one module satisfies)
      return 1;
    } else {
      // AND within rule: need 1 handle per module (all required)
      return rule.modules.length;
    }
  });

  // check how prerequisite rules are connected
  const firstRule = course.prerequisites[0];
  const prerequisiteLinkType = firstRule.prerequisiteLinkType || 'oder';

  if (prerequisiteLinkType === 'oder') {
    // OR between rules: only need handles for the rule with most handles
    return Math.max(...handlesPerRule);
  } else {
    // AND between rules: need sum of all handles
    return handlesPerRule.reduce((sum, handles) => sum + handles, 0);
  }
}

function buildNode(planNode: PlanNode, plan: StudyPlan, showShortNamesOnly: boolean): Node {
  const course = resolveCourse(planNode.courseId) ?? null;
  const slot = toSlotSnapshot(planNode);
  const isElectiveSlot = slot.type === 'elective' || slot.type === 'major';
  const label = course ? getNodeLabel(course, showShortNamesOnly) : getFallbackLabel(slot.type);
  const ects = course?.ects ?? 3;

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
      targetHandles: Math.min(calculateTargetHandles(course), 7)
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

export function selectProviderForRule(
  rule: PrerequisiteRule,
  courseProviders: Map<string, string[]>,
  rowIndex: Record<string, number>
): string[] {
  if (rule.moduleLinkType === 'oder') {
    const allProviders = rule.modules.flatMap(moduleId =>
      courseProviders.get(moduleId) ?? []
    );

    if (allProviders.length === 0) return [];

    const earliest = allProviders.reduce((best, current) => {
      const bestRow = rowIndex[best] ?? Infinity;
      const currentRow = rowIndex[current] ?? Infinity;
      return currentRow < bestRow ? current : best;
    });

    return [earliest];
  } else {
    return rule.modules.flatMap(moduleId => {
      const providers = courseProviders.get(moduleId);
      if (!providers || providers.length === 0) return [];

      const earliest = providers.reduce((best, current) => {
        const bestRow = rowIndex[best] ?? Infinity;
        const currentRow = rowIndex[current] ?? Infinity;
        return currentRow < bestRow ? current : best;
      });

      return [earliest];
    });
  }
}

function buildEdges(
  plan: StudyPlan,
  courseProviders: Map<string, string[]>
): { edges: Edge[]; usage: HandleUsage } {
  const rowIndex = buildPlanRowIndex(plan);
  const edges: Edge[] = [];
  const usage: HandleUsage = {};
  const seen = new Set<string>();

  Object.keys(plan.nodes).forEach((nodeId) => {
    usage[nodeId] = { source: 0, target: 0 };
  });

  Object.values(plan.nodes).forEach((planNode) => {
    if (!planNode.courseId) return;
    const course = resolveCourse(planNode.courseId);
    if (!course) return;

    course.prerequisites.forEach((rule) => {
      const selectedProviders = selectProviderForRule(rule, courseProviders, rowIndex);

      selectedProviders.forEach((providerId) => {
        if (providerId === planNode.id) return;
        const edgeId = `${providerId}=>${planNode.id}`;
        if (seen.has(edgeId)) return;
        seen.add(edgeId);

        const sourceHandle = usage[providerId]?.source ?? 0;
        const targetHandle = usage[planNode.id]?.target ?? 0;

        edges.push({
          id: edgeId,
          source: providerId,
          sourceHandle: `source-${sourceHandle}`,
          target: planNode.id,
          targetHandle: `target-${targetHandle}`,
          markerEnd: { type: MarkerType.ArrowClosed },
          animated: false,
          style: 'stroke-width: 2px;',
          type: 'bezier'
        });

        if (usage[providerId]) usage[providerId].source++;
        if (usage[planNode.id]) usage[planNode.id].target++;
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
      sourceHandles: Math.min(nodeUsage.source, 7)
      // targetHandles are now set in buildNode based on course prerequisites
    };
  });
}
