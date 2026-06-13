import type { Edge, EdgeMarker } from '@xyflow/svelte';
import type { Course, Status } from '../types';
import type { StudyPlan } from '$lib/data/study-plan';

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
const NODE_SHADOW = "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";

function shadowUnlessSelected(isSelected: boolean): string {
  return isSelected ? "" : NODE_SHADOW;
}

// Red dashed border shared by the later/missing/assessment-stage warning states.
function prereqWarningStyle(opacity: number, isSelected: boolean): string {
  return `background: rgb(var(--node-locked-bg)); border-color: rgb(239 68 68); color: rgb(var(--node-locked-text)); border-style: dashed; border-width: 3px; opacity: ${opacity};` + shadowUnlessSelected(isSelected);
}

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
  // Priority order: later prerequisites > missing prerequisites > assessment stage > regular status
  if (hasLaterPrerequisites) return prereqWarningStyle(0.8, isSelected);
  if (hasMissingPrerequisites) return prereqWarningStyle(0.7, isSelected);
  if (hasAssessmentStageViolation) return prereqWarningStyle(0.7, isSelected);

  if (isElectiveSlot) {
    if (!hasSelectedCourse) {
      return "background: rgb(var(--node-locked-bg)); border-color: rgb(var(--node-locked-border)); color: rgb(var(--node-locked-text)); border-style: dashed; opacity: 0.6;";
    }
    return buildStatusBasedStyle(status, isAttended, isCompleted) + "border-style: dashed; " + shadowUnlessSelected(isSelected);
  }

  return buildStatusBasedStyle(status, isAttended, isCompleted) + shadowUnlessSelected(isSelected);
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
function resolveSelectedSlotId(selection: Course | null, plan: StudyPlan): string | undefined {
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
  edge: Edge,
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
  markerType: EdgeMarker,
  isDragging: boolean
): { style: string; markerEnd: EdgeMarker; animated: boolean } {
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
  edge: Edge,
  selection: Course | null,
  statuses: Record<string, Status>,
  slotStatus: Map<string, 'attended' | 'completed'>,
  plan: StudyPlan,
  isDragging: boolean
): { style: string; markerEnd: EdgeMarker; animated: boolean } {
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
    edge.markerEnd as EdgeMarker,
    isDragging
  );

  // Add animation for available targets with incomplete prerequisites
  if (!result.animated && statuses[edge.target as string] === "available" && !sourceCompleted) {
    result.animated = true;
  }

  return result;
}
