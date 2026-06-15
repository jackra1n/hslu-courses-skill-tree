import type { Status } from '../types';
import type { StudyPlan } from '$lib/data/study-plan';
import { resolveCourse } from '$lib/data/study-plan';
import { evaluatePrerequisites } from './prerequisite';
import { getTemplateById } from '$lib/data/courses';

// Courses that require the assessment stage to be passed unlock once this many
// modules are completed.
const ASSESSMENT_STAGE_COMPLETED_THRESHOLD = 6;

export function computeStatuses(
  plan: StudyPlan,
  slotStatus: Map<string, 'attended' | 'completed'>
): Record<string, Status> {
  const statuses: Record<string, Status> = {};
  const completedCount = Array.from(slotStatus.values()).filter((status) => status === 'completed').length;
  const assessmentStageMet = completedCount >= ASSESSMENT_STAGE_COMPLETED_THRESHOLD;

  Object.values(plan.nodes).forEach((node) => {
    const currentStatus = slotStatus.get(node.id);
    if (currentStatus === 'completed') {
      statuses[node.id] = 'completed';
      return;
    }

    if (!node.courseId) {
      statuses[node.id] = node.kind === 'elective' ? 'available' : 'locked';
      return;
    }

    const course = resolveCourse(node.courseId);
    if (!course) {
      statuses[node.id] = 'locked';
      return;
    }

    const prereqsMet = evaluatePrerequisites(course.prerequisites, slotStatus, plan);
    const assessmentMet = !course.assessmentLevelPassed || assessmentStageMet;
    statuses[node.id] = prereqsMet && assessmentMet ? 'available' : 'locked';
  });

  return statuses;
}

/**
 * Checks if a course has prerequisite requirements where none of the required courses exist in the study plan.
 * Handles both OR rules (all modules missing) and AND rules (any module missing).
 * When multiple prerequisite rules exist, they are connected with OR logic (PrerequisiteLinkType).
 * Returns true only if ALL rule groups have missing prerequisites.
 */
export function hasMissingPrerequisites(plan: StudyPlan, nodeId: string): boolean {
  const node = plan.nodes[nodeId];
  if (!node?.courseId) return false;

  const course = resolveCourse(node.courseId);
  if (!course || course.prerequisites.length === 0) return false;

  // Build a set of all course IDs in the plan for quick lookup
  const coursesInPlan = new Set<string>();
  Object.values(plan.nodes).forEach((n) => {
    if (n.courseId) {
      coursesInPlan.add(n.courseId);
    }
  });

  const allRulesHaveMissing = course.prerequisites.every((rule) => {
    const modulesInPlan = rule.modules.filter((moduleId) => coursesInPlan.has(moduleId));

    if (rule.moduleLinkType === 'oder') {
      return modulesInPlan.length === 0;
    } else {
      return modulesInPlan.length < rule.modules.length;
    }
  });
  return allRulesHaveMissing;
}

/**
 * Checks if a course requiring "assessment stage passed" is placed in assessment stage semesters.
 * Assessment stage is semesters 1-2 for full-time programs and 1-3 for part-time programs.
 */
export function hasAssessmentStageViolation(plan: StudyPlan, nodeId: string): boolean {
  const node = plan.nodes[nodeId];
  if (!node?.courseId) return false;

  const course = resolveCourse(node.courseId);
  if (!course?.assessmentLevelPassed) return false;

  // Get the template to determine the model type
  const template = getTemplateById(plan.templateId);
  if (!template) return false;

  // Determine assessment stage semesters based on model
  const assessmentStageSemesters = template.modell === 'parttime' ? 3 : 2;

  // Check if the node is in the assessment stage
  return node.semester <= assessmentStageSemesters;
}
