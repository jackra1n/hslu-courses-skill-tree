import type { Node, Edge } from '@xyflow/svelte';
import type { CurriculumTemplate, ExtendedNodeData, TemplateSlot, Course } from '$lib/types';
import { COURSES } from '$lib/data/courses';
import { getNodeWidth, getNodeLabel } from '$lib/utils/layout';
import { MarkerType } from "@xyflow/svelte";
import { TemplateIndex } from '$lib/utils/template-index';
import { hasPrereqAfter, planEdges } from '$lib/utils/prerequisite';

function buildNode(slot: TemplateSlot, selectedCourse: Course | null, index: TemplateIndex): Node {
  let hasLaterPrerequisites = false;
  
  if (selectedCourse) {
    hasLaterPrerequisites = selectedCourse.prereqs.some(prereq => 
      hasPrereqAfter(slot, prereq, index, { considerSameSemester: true })
    );
  }

  return {
    id: slot.id,
    position: { x: 0, y: 0 },
    type: "custom",
    data: { 
      label: selectedCourse ? getNodeLabel(selectedCourse, false) : `${slot.label} (${slot.credits} ECTS)`,
      slot: slot,
      course: selectedCourse,
      isElectiveSlot: slot.type === "elective" || slot.type === "major",
      width: getNodeWidth(selectedCourse ? selectedCourse.ects : slot.credits),
      hasLaterPrerequisites: hasLaterPrerequisites
    } as ExtendedNodeData,
    style: "",
  };
}

export function toGraph(template: CurriculumTemplate, selections: Record<string, string>): { nodes: Node[]; edges: Edge[] } {
  // Build template index for fast lookups
  const index = new TemplateIndex(template, selections);
  
  // Build nodes
  const nodes: Node[] = [];
  
  template.slots.forEach(slot => {
    if (slot.type === "fixed" && slot.courseId) {
      const course = COURSES.find(c => c.id === slot.courseId);
      if (course) {
        nodes.push(buildNode(slot, course, index));
      }
    } else if (slot.type === "elective" || slot.type === "major") {
      const selectedCourseId = selections[slot.id];
      const selectedCourse = selectedCourseId ? COURSES.find(c => c.id === selectedCourseId) || null : null;
      nodes.push(buildNode(slot, selectedCourse, index));
    }
  });

  // Plan edges using the new approach
  const edgePairs = planEdges(template, selections, index);
  
  // Build edges from planned pairs
  const edges: Edge[] = [];
  const handleUsage: Record<string, { source: number; target: number }> = {};
  
  // Initialize handle usage tracking
  nodes.forEach(node => {
    handleUsage[node.id] = { source: 0, target: 0 };
  });
  
  // Create edges and track handle usage
  edgePairs.forEach(pair => {
    const targetHandleIndex = handleUsage[pair.target.id]?.target || 0;
    const sourceHandleIndex = handleUsage[pair.source.id]?.source || 0;
    
    edges.push({
      id: `${pair.source.id}=>${pair.target.id}`,
      source: pair.source.id,
      sourceHandle: `source-${sourceHandleIndex}`,
      target: pair.target.id,
      targetHandle: `target-${targetHandleIndex}`,
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: false,
      style: "stroke-width: 2px;",
      type: "bezier",
    });

    if (handleUsage[pair.target.id]) handleUsage[pair.target.id].target++;
    if (handleUsage[pair.source.id]) handleUsage[pair.source.id].source++;
  });
  
  // Compute handle counts from edge usage and attach to nodes
  nodes.forEach(node => {
    const usage = handleUsage[node.id];
    if (usage) {
      node.data = {
        ...node.data,
        sourceHandles: Math.min(usage.source, 4),
        targetHandles: Math.min(usage.target, 4)
      };
    }
  });
  
  return { nodes, edges };
}
