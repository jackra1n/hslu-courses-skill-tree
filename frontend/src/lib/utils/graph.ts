import type { Node, Edge } from '@xyflow/svelte';
import type { ExtendedNodeData, Course, TemplateSlot } from '$lib/types';
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
      hasLaterPrerequisites: hasPlanPrereqConflict(plan, planNode.id)
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

function buildEdges(
  plan: StudyPlan,
  courseProviders: Map<string, string[]>
): { edges: Edge[]; usage: HandleUsage } {
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
      rule.modules.forEach((moduleId) => {
        const providers = courseProviders.get(moduleId);
        if (!providers) return;

        providers.forEach((providerId) => {
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
  });

  return { edges, usage };
}

function applyHandleUsage(nodes: Node[], usage: HandleUsage): void {
  nodes.forEach((node) => {
    const nodeUsage = usage[node.id];
    if (!nodeUsage) return;
    node.data = {
      ...(node.data as ExtendedNodeData),
      sourceHandles: Math.min(nodeUsage.source, 7),
      targetHandles: Math.min(nodeUsage.target, 7)
    };
  });
}
