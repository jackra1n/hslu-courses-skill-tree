import type { Status } from '../types';
import type { StudyPlan } from '$lib/data/study-plan';
import { resolveCourse } from '$lib/data/study-plan';
import { evaluatePrerequisites } from './prerequisite';
import { getTemplateById } from '$lib/data/courses';

export function computeStatuses(
  plan: StudyPlan,
  slotStatus: Map<string, 'attended' | 'completed'>
): Record<string, Status> {
  const statuses: Record<string, Status> = {};
  const completedCount = Array.from(slotStatus.values()).filter((status) => status === 'completed').length;
  const assessmentStageMet = completedCount >= 6;

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

  // Check each prerequisite rule
  return course.prerequisites.some((rule) => {
    // Check which modules from this rule exist in the plan
    const modulesInPlan = rule.modules.filter((moduleId) => coursesInPlan.has(moduleId));

    if (rule.moduleLinkType === 'oder') {
      // OR rule: return true if ALL modules are missing (none in plan)
      return modulesInPlan.length === 0;
    } else {
      // AND rule: return true if ANY module is missing (not all in plan)
      return modulesInPlan.length < rule.modules.length;
    }
  });
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

/**
 * Builds base node styles including dimensions, typography, and transitions.
 * These styles are common to all nodes regardless of their state.
 */
function buildBaseNodeStyle(nodeWidth: number, isDragging: boolean): string {
  const transition = !isDragging ? 'transition: all 0.2s;' : '';
  return `border-radius: 12px; font-weight: 500; font-size: 14px; text-align: center; min-width: ${nodeWidth}px; width: ${nodeWidth}px; font-family: Inter, sans-serif; ${transition} `;
}

/**
 * Builds selection-specific styles for nodes.
 * Selected nodes have thicker borders, shadows, and scale transforms.
 */
function buildSelectionStyle(isSelected: boolean): string {
  if (isSelected) {
    return "border-width: 3px; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3), 0 4px 6px rgba(0,0,0,0.1); transform: scale(1.05); ";
  }
  return "border-width: 2px; ";
}

/**
 * Builds state-specific styles for nodes based on their status and progress.
 * Handles special cases like later prerequisites (red dashed border), missing prerequisites, and assessment stage violations.
 */
function buildNodeStateStyle(
  status: Status,
  isAttended: boolean,
  isCompleted: boolean,
  isElectiveSlot: boolean,
  hasSelectedCourse: boolean,
  hasLaterPrerequisites: boolean,
  hasMissingPrerequisites: boolean,
  hasAssessmentStageViolation: boolean,
  isSelected: boolean
): string {
  let style = "";

  // Priority order: later prerequisites > missing prerequisites > assessment stage violation > regular status
  
  // Special case: nodes with later prerequisites get red dashed border (highest priority)
  if (hasLaterPrerequisites) {
    style += "background: rgb(var(--node-locked-bg)); border-color: rgb(239 68 68); color: rgb(var(--node-locked-text)); border-style: dashed; border-width: 3px; opacity: 0.8;";
    if (!isSelected) style += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
    return style;
  }

  // Special case: nodes with missing prerequisites get red dashed border (second priority)
  if (hasMissingPrerequisites) {
    style += "background: rgb(var(--node-locked-bg)); border-color: rgb(239 68 68); color: rgb(var(--node-locked-text)); border-style: dashed; border-width: 3px; opacity: 0.7;";
    if (!isSelected) style += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
    return style;
  }

  // Special case: nodes with assessment stage violations get red dashed border (third priority)
  if (hasAssessmentStageViolation) {
    style += "background: rgb(var(--node-locked-bg)); border-color: rgb(239 68 68); color: rgb(var(--node-locked-text)); border-style: dashed; border-width: 3px; opacity: 0.7;";
    if (!isSelected) style += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
    return style;
  }

  // Elective slots have dashed borders and special handling when no course is selected
  if (isElectiveSlot) {
    if (!hasSelectedCourse) {
      style += "background: rgb(var(--node-locked-bg)); border-color: rgb(var(--node-locked-border)); color: rgb(var(--node-locked-text)); border-style: dashed; opacity: 0.6;";
      return style;
    }
    // When course is selected, apply status-based styling with dashed border
    style += buildStatusBasedStyle(status, isAttended, isCompleted) + "border-style: dashed; ";
    if (!isSelected) style += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
    return style;
  }

  // Regular nodes use status-based styling
  style += buildStatusBasedStyle(status, isAttended, isCompleted);
  if (!isSelected) style += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
  return style;
}

/**
 * Builds status-based color and opacity styles.
 * Priority: completed > attended > available > locked
 */
function buildStatusBasedStyle(status: Status, isAttended: boolean, isCompleted: boolean): string {
  if (isCompleted) {
    return "background: rgb(var(--node-completed-bg)); border-color: rgb(var(--node-completed-border)); color: rgb(var(--text-primary)); ";
  }
  if (isAttended) {
    return "background: rgb(var(--node-attended-bg)); border-color: rgb(var(--node-attended-border)); color: rgb(var(--text-primary)); ";
  }
  if (status === "available") {
    return "background: rgb(var(--node-available-bg)); border-color: rgb(var(--node-available-border)); color: rgb(var(--text-primary)); ";
  }
  // locked state
  return "background: rgb(var(--node-locked-bg)); border-color: rgb(var(--node-locked-border)); color: rgb(var(--node-locked-text)); opacity: 0.6;";
}

/**
 * Computes complete node style string based on all node properties.
 * This is the main entry point for node styling.
 */
export function getNodeStyle(
  status: Status,
  isSelected: boolean,
  isAttended: boolean,
  isCompleted: boolean,
  isElectiveSlot: boolean,
  nodeWidth: number,
  hasSelectedCourse: boolean,
  hasLaterPrerequisites: boolean,
  hasMissingPrerequisites: boolean,
  hasAssessmentStageViolation: boolean,
  isDragging: boolean
): string {
  return (
    buildBaseNodeStyle(nodeWidth, isDragging) +
    buildSelectionStyle(isSelected) +
    buildNodeStateStyle(status, isAttended, isCompleted, isElectiveSlot, hasSelectedCourse, hasLaterPrerequisites, hasMissingPrerequisites, hasAssessmentStageViolation, isSelected)
  );
}

/**
 * Resolves the selected slot ID, handling both direct slot selection and course selection.
 * When a course is selected, finds the corresponding slot ID.
 */
function resolveSelectedSlotId(selection: any, plan: StudyPlan): string | undefined {
  if (!selection) return undefined;

  if (plan.nodes[selection.id]) {
    return selection.id;
  }

  const matchingNode = Object.values(plan.nodes).find((node) => node.courseId === selection.id);
  return matchingNode?.id;
}

/**
 * Determines edge relationship to selected node.
 * Returns whether edge is a prerequisite, dependent, or unrelated to selection.
 */
function getEdgeRelationship(
  edge: any,
  selectedSlotId: string | undefined
): { isSelected: boolean; isPrerequisite: boolean; isDependent: boolean } {
  const isSelected = selectedSlotId === edge.source || selectedSlotId === edge.target;
  const isPrerequisite = selectedSlotId === edge.target;
  const isDependent = selectedSlotId === edge.source;

  return { isSelected, isPrerequisite, isDependent };
}

/**
 * Builds edge style based on completion status and selection state.
 * Handles prerequisite highlighting, completion visualization, and animations.
 */
function buildEdgeStateStyle(
  isSelected: boolean,
  isPrerequisite: boolean,
  isDependent: boolean,
  sourceCompleted: boolean,
  targetCompleted: boolean,
  markerType: any,
  isDragging: boolean
): { style: string; markerEnd: any; animated: boolean } {
  const transition = !isDragging ? 'transition: all 0.2s;' : '';
  let style = `stroke-width: 2px; ${transition} filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1)); `;
  let markerEnd = markerType;
  let animated = false;

  if (isSelected) {
    // Highlight prerequisites in amber with dashed line
    if (isPrerequisite) {
      style += "stroke: rgb(245 158 11); stroke-width: 3px; stroke-dasharray: 5,5; ";
      markerEnd = { type: markerType.type, color: "rgb(245 158 11)" };
    }
    // Highlight dependents in blue
    else if (isDependent) {
      style += "stroke: rgb(59 130 246); stroke-width: 3px; ";
      markerEnd = { type: markerType.type, color: "rgb(59 130 246)" };
    }
  } else {
    // Show completion progress with green edges
    if (sourceCompleted && targetCompleted) {
      style += "stroke: rgb(34 197 94); stroke-width: 3px; ";
      markerEnd = { type: markerType.type, color: "rgb(34 197 94)" };
    } else if (sourceCompleted) {
      style += "stroke: rgb(34 197 94); stroke-width: 3px; ";
      markerEnd = { type: markerType.type, color: "rgb(34 197 94)" };
      animated = true;
    } else {
      style += "stroke: rgb(var(--border-primary)); stroke-opacity: 0.6; ";
      markerEnd = { type: markerType.type };
    }
  }

  return { style, markerEnd, animated };
}

/**
 * Computes complete edge styling including color, width, animation, and markers.
 * This is the main entry point for edge styling.
 */
export function getEdgeStyle(
  edge: any,
  selection: any,
  statuses: Record<string, Status>,
  slotStatus: Map<string, 'attended' | 'completed'>,
  plan: StudyPlan,
  isDragging: boolean
): { style: string; markerEnd: any; animated: boolean } {
  const selectedSlotId = resolveSelectedSlotId(selection, plan);
  const { isSelected, isPrerequisite, isDependent } = getEdgeRelationship(edge, selectedSlotId);

  const sourceCompleted = slotStatus.get(edge.source) === 'completed';
  const targetCompleted = slotStatus.get(edge.target) === 'completed';

  const result = buildEdgeStateStyle(
    isSelected,
    isPrerequisite,
    isDependent,
    sourceCompleted,
    targetCompleted,
    edge.markerEnd,
    isDragging
  );

  // Add animation for available targets with incomplete prerequisites
  if (!result.animated && statuses[edge.target as string] === "available" && !sourceCompleted) {
    result.animated = true;
  }

  return result;
}
