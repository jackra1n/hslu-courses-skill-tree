import { MarkerType, type Edge, type EdgeMarker } from '@xyflow/svelte';
import type { Course, Status } from '../types';
import type { StudyPlan } from '$lib/data/study-plan';

// Edge.markerEnd may be a string id or undefined; normalise to an object marker.
function toEdgeMarker(marker: Edge['markerEnd']): EdgeMarker {
  return marker && typeof marker === 'object' ? marker : { type: MarkerType.ArrowClosed };
}

function buildBaseNodeStyle(nodeWidth: number, isDragging: boolean): string {
  const transition = !isDragging ? 'transition: all 0.2s;' : '';
  return `border-radius: 12px; font-weight: 500; font-size: 14px; text-align: center; min-width: ${nodeWidth}px; width: ${nodeWidth}px; font-family: Inter, sans-serif; ${transition} `;
}

function buildSelectionStyle(isSelected: boolean): string {
  if (isSelected) {
    // Violet ring so selection reads regardless of node status colour.
    return "border-width: 3px; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.55), 0 4px 10px rgba(0,0,0,0.15); transform: scale(1.05); ";
  }
  return "border-width: 2px; ";
}

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

// Priority: completed > attended > available > locked
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

export type NodeStyleInput = {
  status: Status;
  isSelected: boolean;
  isAttended: boolean;
  isCompleted: boolean;
  isElectiveSlot: boolean;
  nodeWidth: number;
  hasSelectedCourse: boolean;
  hasLaterPrerequisites: boolean;
  hasMissingPrerequisites: boolean;
  hasAssessmentStageViolation: boolean;
  isDragging: boolean;
};

export function getNodeStyle(input: NodeStyleInput): string {
  const style =
    buildBaseNodeStyle(input.nodeWidth, input.isDragging) +
    buildSelectionStyle(input.isSelected) +
    buildNodeStateStyle(
      input.status,
      input.isAttended,
      input.isCompleted,
      input.isElectiveSlot,
      input.hasSelectedCourse,
      input.hasLaterPrerequisites,
      input.hasMissingPrerequisites,
      input.hasAssessmentStageViolation,
      input.isSelected
    );

  // Selection must stay fully visible and legible even on dimmed locked nodes.
  if (input.isSelected) {
    return style + "opacity: 1; color: rgb(var(--text-primary)); ";
  }
  return style;
}

// The selection may be a slot id or a course id; resolve to the slot it sits in.
function resolveSelectedSlotId(selection: Course | null, plan: StudyPlan): string | undefined {
  if (!selection) return undefined;

  if (plan.nodes[selection.id]) {
    return selection.id;
  }

  const matchingNode = Object.values(plan.nodes).find((node) => node.courseId === selection.id);
  return matchingNode?.id;
}

function getEdgeRelationship(
  edge: Edge,
  selectedSlotId: string | undefined
): { isSelected: boolean; isPrerequisite: boolean; isDependent: boolean } {
  const isSelected = selectedSlotId === edge.source || selectedSlotId === edge.target;
  const isPrerequisite = selectedSlotId === edge.target;
  const isDependent = selectedSlotId === edge.source;

  return { isSelected, isPrerequisite, isDependent };
}

export type EdgeStyleResult = {
  style: string;
  markerEnd: EdgeMarker;
  animated: boolean;
  zIndex: number;
};

// Highlighted edges sit above nodes so they aren't hidden behind boxes.
const EDGE_Z_HIGHLIGHTED = 1000;
const EDGE_Z_BASE = 0;

type EdgeStateInput = {
  isPrerequisite: boolean;
  isDependent: boolean;
  hasSelection: boolean;
  sourceCompleted: boolean;
  targetCompleted: boolean;
  targetAvailable: boolean;
  markerType: EdgeMarker;
  isDragging: boolean;
};

function buildEdgeStateStyle(input: EdgeStateInput): EdgeStyleResult {
  const transition = !input.isDragging ? 'transition: all 0.2s;' : '';
  const base = `stroke-width: 2px; ${transition} filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1)); `;
  const { markerType } = input;

  // A node is selected: spotlight its edges and fade everything else.
  if (input.hasSelection) {
    if (input.isPrerequisite) {
      return {
        style: base + "stroke: rgb(245 158 11); stroke-width: 3px; stroke-dasharray: 5,5; ",
        markerEnd: { type: markerType.type, color: "rgb(245 158 11)" },
        animated: false,
        zIndex: EDGE_Z_HIGHLIGHTED,
      };
    }
    if (input.isDependent) {
      return {
        style: base + "stroke: rgb(59 130 246); stroke-width: 3px; ",
        markerEnd: { type: markerType.type, color: "rgb(59 130 246)" },
        animated: false,
        zIndex: EDGE_Z_HIGHLIGHTED,
      };
    }
    return {
      style: base + "stroke: rgb(var(--border-primary)); stroke-opacity: 0.12; ",
      markerEnd: { type: markerType.type },
      animated: false,
      zIndex: EDGE_Z_BASE,
    };
  }

  // No selection: colour by completion, animate only the unlocked frontier.
  if (input.sourceCompleted) {
    return {
      style: base + "stroke: rgb(34 197 94); stroke-width: 3px; ",
      markerEnd: { type: markerType.type, color: "rgb(34 197 94)" },
      animated: !input.targetCompleted && input.targetAvailable,
      zIndex: EDGE_Z_BASE,
    };
  }
  return {
    style: base + "stroke: rgb(var(--border-primary)); stroke-opacity: 0.6; ",
    markerEnd: { type: markerType.type },
    animated: input.targetAvailable,
    zIndex: EDGE_Z_BASE,
  };
}

export function getEdgeStyle(
  edge: Edge,
  selection: Course | null,
  statuses: Record<string, Status>,
  slotStatus: Map<string, 'attended' | 'completed'>,
  plan: StudyPlan,
  isDragging: boolean
): EdgeStyleResult {
  const selectedSlotId = resolveSelectedSlotId(selection, plan);
  const { isPrerequisite, isDependent } = getEdgeRelationship(edge, selectedSlotId);

  return buildEdgeStateStyle({
    isPrerequisite,
    isDependent,
    hasSelection: selectedSlotId !== undefined,
    sourceCompleted: slotStatus.get(edge.source) === 'completed',
    targetCompleted: slotStatus.get(edge.target) === 'completed',
    targetAvailable: statuses[edge.target as string] === 'available',
    markerType: toEdgeMarker(edge.markerEnd),
    isDragging,
  });
}
