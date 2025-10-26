import type { Course, CurriculumTemplate, TemplateSlot } from '$lib/data/courses';
import { COURSES } from '$lib/data/courses';

export type PlanNodeKind = 'fixed' | 'elective' | 'custom';

export type PlanNode = {
  id: string;
  kind: PlanNodeKind;
  slotType: TemplateSlot['type'] | 'custom';
  semester: number;
  baseCourseId?: string;
  courseId?: string | null;
  ects: number;
  label: string;
};

export type PlanRow = {
  semester: number;
  nodeOrder: string[];
};

export type StudyPlan = {
  templateId: string;
  planCode: string;
  rows: PlanRow[];
  nodes: Record<string, PlanNode>;
};

function getDefaultLabel(slotType: TemplateSlot['type'] | 'custom'): string {
  if (slotType === 'elective') return 'Wahl-Modul';
  if (slotType === 'major') return 'Major-Modul';
  if (slotType === 'custom') return 'Custom-Modul';
  return 'Course';
}

export function resolveCourse(id?: string | null): Course | undefined {
  if (!id) return undefined;
  return COURSES.find((course) => course.id === id);
}

function toPlanNode(slot: TemplateSlot, selections: Record<string, string>): PlanNode {
  const kind: PlanNodeKind = slot.type === 'fixed' ? 'fixed' : 'elective';
  const assignedCourseId = slot.type === 'fixed' ? slot.courseId : selections[slot.id];
  const course = resolveCourse(assignedCourseId);

  return {
    id: slot.id,
    kind,
    slotType: slot.type,
    semester: slot.semester,
    baseCourseId: slot.courseId,
    courseId: assignedCourseId,
    ects: course?.ects ?? 0,
    label: course?.label ?? getDefaultLabel(slot.type)
  };
}

export function createStudyPlan(
  template: CurriculumTemplate,
  selections: Record<string, string>
): StudyPlan {
  const nodes: Record<string, PlanNode> = {};
  const rowsBySemester = new Map<number, string[]>();

  template.slots.forEach((slot) => {
    nodes[slot.id] = toPlanNode(slot, selections);
    const semRows = rowsBySemester.get(slot.semester) ?? [];
    semRows.push(slot.id);
    rowsBySemester.set(slot.semester, semRows);
  });

  const rows: PlanRow[] = Array.from(rowsBySemester.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([semester, nodeOrder]) => ({
      semester,
      nodeOrder
    }));

  return normalizePlan({
    templateId: template.id,
    planCode: template.plan,
    rows,
    nodes
  });
}

export function deriveSelections(plan: StudyPlan): Record<string, string> {
  const selections: Record<string, string> = {};

  Object.values(plan.nodes).forEach((node) => {
    if (node.kind === 'elective' && node.courseId) {
      selections[node.id] = node.courseId;
    }
  });

  return selections;
}

export function updateNodeCourse(
  plan: StudyPlan,
  nodeId: string,
  courseId: string | null
): StudyPlan {
  const node = plan.nodes[nodeId];
  if (!node) return plan;

  const course = resolveCourse(courseId ?? undefined);
  const nextNode: PlanNode = {
    ...node,
    courseId: courseId,
    ects: course?.ects ?? 0,
    label: course?.label ?? getDefaultLabel(node.slotType)
  };

  return {
    ...plan,
    nodes: {
      ...plan.nodes,
      [nodeId]: nextNode
    }
  };
}

export function calculatePlanTotalCredits(plan: StudyPlan): number {
  return Object.values(plan.nodes).reduce((sum, node) => sum + (node.ects || 0), 0);
}

export function calculatePlanSemesterCredits(plan: StudyPlan, semester: number): number {
  const row = plan.rows.find((r) => r.semester === semester);
  if (!row) return 0;

  return row.nodeOrder.reduce((sum, nodeId) => {
    const node = plan.nodes[nodeId];
    return sum + (node?.ects || 0);
  }, 0);
}

export function getPlanNodeCourse(node: PlanNode): Course | undefined {
  return resolveCourse(node.courseId);
}

export function normalizePlan(plan: StudyPlan): StudyPlan {
  const nextRows: PlanRow[] = plan.rows.map((row, index) => ({
    semester: index + 1,
    nodeOrder: [...row.nodeOrder]
  }));

  const nextNodes: Record<string, PlanNode> = { ...plan.nodes };
  nextRows.forEach((row) => {
    row.nodeOrder.forEach((nodeId) => {
      const node = nextNodes[nodeId];
      if (node && node.semester !== row.semester) {
        nextNodes[nodeId] = { ...node, semester: row.semester };
      }
    });
  });

  return {
    ...plan,
    rows: nextRows,
    nodes: nextNodes
  };
}

export function buildPlanRowIndex(plan: StudyPlan): Record<string, number> {
  const lookup: Record<string, number> = {};
  plan.rows.forEach((row, rowIndex) => {
    row.nodeOrder.forEach((nodeId) => {
      lookup[nodeId] = rowIndex;
    });
  });
  return lookup;
}

export function mapPlanCourseProviders(plan: StudyPlan): Map<string, string[]> {
  const map = new Map<string, string[]>();
  Object.entries(plan.nodes).forEach(([nodeId, node]) => {
    if (!node.courseId) return;
    const current = map.get(node.courseId) ?? [];
    current.push(nodeId);
    map.set(node.courseId, current);
  });
  return map;
}
