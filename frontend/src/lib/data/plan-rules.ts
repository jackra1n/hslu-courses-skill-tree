import { getTemplateById } from '$lib/data/courses';
import {
  createStudyPlan,
  deriveSelections,
  type PlanRow,
  type StudyPlan
} from '$lib/data/study-plan';
import { progressStore } from '$lib/stores/progressStore.svelte';

// Whether `courseId` may be assigned to the elective slot `slotId`.
// Blocks duplicates of completed/fixed courses unless the student has actually
// attended an extra instance in a later semester.
export function canSelectCourse(plan: StudyPlan, slotId: string, courseId: string): boolean {
  const node = plan.nodes[slotId];
  if (!node || node.slotType === 'fixed') return false;

  if (progressStore.hasCompletedInstance(courseId, plan)) return false;

  const fixedNodes = Object.values(plan.nodes).filter(
    (planNode) => planNode.kind === 'fixed' && planNode.courseId === courseId
  );

  if (fixedNodes.length > 0) {
    // The course is part of the fixed curriculum; only allow a repeat if it was
    // attended and this slot sits after the earliest fixed occurrence.
    if (!progressStore.hasAttendedInstance(courseId, plan)) return false;
    const earliestFixed = Math.min(...fixedNodes.map((planNode) => planNode.semester));
    if (node.semester <= earliestFixed) return false;
  }

  const selections = deriveSelections(plan);
  const conflictingSlotId = Object.entries(selections).find(
    ([otherSlotId, otherCourseId]) => otherSlotId !== slotId && otherCourseId === courseId
  )?.[0];

  if (!conflictingSlotId) return true;

  // Same course already chosen elsewhere: only allowed as a repeat attempt in a
  // different semester than the conflicting one.
  if (progressStore.hasAttendedInstance(courseId, plan)) {
    const conflictingNode = plan.nodes[conflictingSlotId];
    return conflictingNode ? conflictingNode.semester !== node.semester : true;
  }

  return false;
}

// Whether the plan diverges from the template's pristine default: nodes added or
// removed, a slot moved or re-assigned, or rows reordered.
export function isPlanCustomized(plan: StudyPlan): boolean {
  const template = getTemplateById(plan.templateId);
  if (!template) return false;

  const defaultPlan = createStudyPlan(template, {});
  const currentIds = Object.keys(plan.nodes);
  const defaultIds = Object.keys(defaultPlan.nodes);

  if (currentIds.length !== defaultIds.length) return true;
  if (currentIds.some((id) => !defaultPlan.nodes[id])) return true;

  const slotChanged = currentIds.some((id) => {
    const current = plan.nodes[id];
    const original = defaultPlan.nodes[id];
    return (
      current.semester !== original.semester ||
      (current.courseId ?? null) !== (original.courseId ?? null)
    );
  });
  if (slotChanged) return true;

  return !rowsEqual(plan.rows, defaultPlan.rows);
}

function rowsEqual(a: PlanRow[], b: PlanRow[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (row, i) =>
      row.nodeOrder.length === b[i].nodeOrder.length &&
      row.nodeOrder.every((id, j) => id === b[i].nodeOrder[j])
  );
}
