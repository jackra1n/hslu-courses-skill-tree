import type { Status, CurriculumTemplate } from '../types';
import { 
  COURSES
} from '../data/courses';
import { evaluatePrerequisites } from './prerequisite';

export function computeStatuses(
  template: CurriculumTemplate,
  selections: Record<string, string>,
  attended: Set<string>,
  completed: Set<string>
): Record<string, Status> {
  const s: Record<string, Status> = {};
  
  template.slots.forEach(slot => {
    if (slot.type === "fixed" && slot.courseId) {
      const course = COURSES.find(c => c.id === slot.courseId);
      if (course) {
        if (completed.has(course.id)) {
          s[slot.id] = "completed";
        } else if (evaluatePrerequisites(course.prerequisites, attended, completed)) {
          s[slot.id] = "available";
        } else {
          s[slot.id] = "locked";
        }
      }
    } else if (slot.type === "elective" || slot.type === "major") {
      const selectedCourseId = selections[slot.id];
      if (selectedCourseId) {
        const course = COURSES.find(c => c.id === selectedCourseId);
        if (course) {
          if (completed.has(course.id)) {
            s[slot.id] = "completed";
          } else if (evaluatePrerequisites(course.prerequisites, attended, completed)) {
            s[slot.id] = "available";
          } else {
            s[slot.id] = "locked";
          }
        }
      } else {
        s[slot.id] = "available";
      }
    }
  });
  
  return s;
}

export function getNodeStyle(
  nodeId: string,
  status: Status,
  isSelected: boolean,
  isAttended: boolean,
  isCompleted: boolean,
  isElectiveSlot: boolean,
  nodeWidth: number,
  hasSelectedCourse: boolean
): string {
  let styleStr = `border-radius: 12px; font-weight: 500; font-size: 14px; text-align: center; min-width: ${nodeWidth}px; width: ${nodeWidth}px; font-family: Inter, sans-serif; transition: all 0.2s; `;

  if (isSelected) {
    styleStr += "border-width: 3px; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3), 0 4px 6px rgba(0,0,0,0.1); transform: scale(1.05); ";
  } else {
    styleStr += "border-width: 2px; ";
  }
  
  if (isElectiveSlot) {
    if (hasSelectedCourse) {
      // there's a selected course - use normal status-based styling
      if (isCompleted) {
        styleStr += "background: rgb(var(--node-completed-bg)); border-color: rgb(var(--node-completed-border)); color: rgb(var(--text-primary)); border-style: dashed; ";
      } else if (isAttended) {
        styleStr += "background: rgb(var(--node-attended-bg)); border-color: rgb(var(--node-attended-border)); color: rgb(var(--text-primary)); border-style: dashed; ";
      } else if (status === "available") {
        styleStr += "background: rgb(var(--node-available-bg)); border-color: rgb(var(--node-available-border)); color: rgb(var(--text-primary)); border-style: dashed; ";
      } else {
        // locked state for selected course
        styleStr += "background: rgb(var(--node-locked-bg)); border-color: rgb(var(--node-locked-border)); color: rgb(var(--node-locked-text)); border-style: dashed; opacity: 0.6;";
      }
    } else {
      // no course selected - disabled state
      styleStr += "background: rgb(var(--node-locked-bg)); border-color: rgb(var(--node-locked-border)); color: rgb(var(--node-locked-text)); border-style: dashed; opacity: 0.6;";
    }
    if (!isSelected) styleStr += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
  } else if (status === "completed") {
    styleStr += "background: rgb(var(--node-completed-bg)); border-color: rgb(var(--node-completed-border)); color: rgb(var(--text-primary)); ";
    if (!isSelected) styleStr += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
  } else if (isAttended) {
    styleStr += "background: rgb(var(--node-attended-bg)); border-color: rgb(var(--node-attended-border)); color: rgb(var(--text-primary)); ";
    if (!isSelected) styleStr += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
  } else if (status === "available") {
    styleStr += "background: rgb(var(--node-available-bg)); border-color: rgb(var(--node-available-border)); color: rgb(var(--text-primary)); ";
    if (!isSelected) styleStr += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
  } else {
    styleStr += "background: rgb(var(--node-locked-bg)); border-color: rgb(var(--node-locked-border)); color: rgb(var(--node-locked-text)); opacity: 0.6;";
  }
  
  return styleStr;
}

export function getEdgeStyle(
  edge: any,
  selection: any,
  statuses: Record<string, Status>,
  completed: Set<string>,
  currentTemplate: CurriculumTemplate
): { style: string; markerEnd: any; animated: boolean } {
  let selectedSlotId = selection?.id;
  if (selection && !selection.id.startsWith('elective') && !selection.id.startsWith('major')) {
    const selectedSlot = currentTemplate.slots.find(slot => slot.courseId === selection!.id);
    selectedSlotId = selectedSlot?.id;
  }
  
  const isSelected = selectedSlotId === edge.source || selectedSlotId === edge.target;
  const isPrerequisite = selectedSlotId === edge.target;
  const isDependent = selectedSlotId === edge.source;
  
  const sourceSlot = currentTemplate.slots.find(slot => slot.id === edge.source);
  const sourceCourse = sourceSlot?.courseId ? COURSES.find(c => c.id === sourceSlot.courseId) : null;
  const sourceCompleted = sourceCourse ? completed.has(sourceCourse.id) : false;
  
  const targetSlot = currentTemplate.slots.find(slot => slot.id === edge.target);
  const targetCourse = targetSlot?.courseId ? COURSES.find(c => c.id === targetSlot.courseId) : null;
  const targetCompleted = targetCourse ? completed.has(targetCourse.id) : false;
  
  let edgeStyle = "stroke-width: 2px; transition: all 0.2s; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1)); ";
  let markerEnd = edge.markerEnd;
  let animated = false;
  
  if (isSelected) {
    if (isPrerequisite) {
      edgeStyle += "stroke: rgb(245 158 11); stroke-width: 3px; stroke-dasharray: 5,5; ";
      markerEnd = { type: edge.markerEnd.type, color: "rgb(245 158 11)" };
    } else if (isDependent) {
      edgeStyle += "stroke: rgb(59 130 246); stroke-width: 3px; ";
      markerEnd = { type: edge.markerEnd.type, color: "rgb(59 130 246)" };
    }
  } else {
    if (sourceCompleted && targetCompleted) {
      edgeStyle += "stroke: rgb(34 197 94); stroke-width: 3px; ";
      markerEnd = { type: edge.markerEnd.type, color: "rgb(34 197 94)" };
    }
    else if (sourceCompleted) {
      edgeStyle += "stroke: rgb(34 197 94); stroke-width: 3px; ";
      markerEnd = { type: edge.markerEnd.type, color: "rgb(34 197 94)" };
      animated = true;
    }
    else {
      edgeStyle += "stroke: rgb(var(--border-primary)); stroke-opacity: 0.6; ";
      markerEnd = { type: edge.markerEnd.type };
    }
  }
  
  return {
    style: edgeStyle,
    markerEnd,
    animated: animated || (statuses[edge.target as string] === "available" && !sourceCompleted)
  };
}
