<script lang="ts">
  import { onMount } from "svelte";
  import {
    SvelteFlow,
    Background,
    Controls,
    MiniMap,
    type OnMove,
    type NodeTargetEventWithPointer,
    MarkerType,
  } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";
  
  import {
    nodes,
    edges,
    currentTemplate,
    userSelections,
    courseStore
  } from '$lib/stores/courseStore.svelte';
  import {
    selection,
    viewport,
    showCourseTypeBadges,
    uiStore
  } from '$lib/stores/uiStore.svelte';
  import { slotStatusMap, progressStore } from '$lib/stores/progressStore.svelte';
  import { theme } from '$lib/stores/theme.svelte';
  import CustomNode from './CustomNode.svelte';
  import SemesterDivider from './SemesterDivider.svelte';
  import DisclaimerToast from '$lib/components/ui/DisclaimerToast.svelte';
  import { computeStatuses } from '$lib/utils/status';
  import { getNodeWidth } from '$lib/utils/layout';
  import { COURSES } from '$lib/data/courses';

  import type { Course } from '$lib/types';

  type MarkerEnd = {
    type: MarkerType | `${MarkerType}`;
    color?: string;
  };

  function isMarkerEnd(marker: unknown): marker is MarkerEnd {
    return (
      typeof marker === 'object' &&
      marker !== null &&
      'type' in marker &&
      typeof (marker as any).type === 'string'
    );
  }

  const nodeTypes = {
    custom: CustomNode
  };

  let isDragging = $state(false);

  const totalSemesters = $derived.by(() => {
    const semesters = currentTemplate()?.slots?.map(slot => slot.semester) ?? [];
    if (!semesters.length) return 1;
    return Math.max(1, Math.max(...semesters));
  });

  const semesterNumbers = $derived.by(() => Array.from({ length: totalSemesters }, (_, idx) => idx + 1));

  const styledNodes = $derived.by(() => {
    const statuses = computeStatuses(currentTemplate(), userSelections(), slotStatusMap());

    return nodes().map((n) => {
      const s = statuses[n.id];
      const data = n.data as any;
      const slot = data.slot;
      const course = data.course;
      const isElectiveSlot = data.isElectiveSlot;

      const slotStatus = slot ? progressStore.getSlotStatus(slot.id) : null;
      const isAttended = slotStatus === 'attended';
      const isCompleted = slotStatus === 'completed';
      const isSelected = selection()?.id === n.id || (course && selection()?.id === course.id);
      
      const nodeWidth = data.width || getNodeWidth(course?.ects || slot?.credits || 6);
      let styleStr = `border-radius: 12px; font-weight: 500; font-size: 14px; text-align: center; min-width: ${nodeWidth}px; width: ${nodeWidth}px; font-family: Inter, sans-serif; ${!isDragging ? 'transition: all 0.2s;' : ''}; `;

      if (isSelected) {
        styleStr += "border-width: 3px; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3), 0 4px 6px rgba(0,0,0,0.1); transform: scale(1.05); ";
      } else {
        styleStr += "border-width: 2px; ";
      }
      
      const hasLaterPrerequisites = data.hasLaterPrerequisites || false;
      
      if (isElectiveSlot) {
        const selectedCourseId = userSelections()[slot?.id || ''];
        const selectedCourse = selectedCourseId ? COURSES.find((c: any) => c.id === selectedCourseId) : null;
        
        if (selectedCourse) {
          if (hasLaterPrerequisites) {
            styleStr += "background: rgb(var(--node-locked-bg)); border-color: rgb(239 68 68); color: rgb(var(--node-locked-text)); border-style: dashed; border-width: 3px; opacity: 0.8;";
          } else if (isCompleted) {
            styleStr += "background: rgb(var(--node-completed-bg)); border-color: rgb(var(--node-completed-border)); color: rgb(var(--text-primary)); border-style: dashed; ";
          } else if (isAttended) {
            styleStr += "background: rgb(var(--node-attended-bg)); border-color: rgb(var(--node-attended-border)); color: rgb(var(--text-primary)); border-style: dashed; ";
          } else if (s === "available") {
            styleStr += "background: rgb(var(--node-available-bg)); border-color: rgb(var(--node-available-border)); color: rgb(var(--text-primary)); border-style: dashed; ";
          } else {
            styleStr += "background: rgb(var(--node-locked-bg)); border-color: rgb(var(--node-locked-border)); color: rgb(var(--node-locked-text)); border-style: dashed; opacity: 0.6;";
          }
        } else {
          styleStr += "background: rgb(var(--node-locked-bg)); border-color: rgb(var(--node-locked-border)); color: rgb(var(--node-locked-text)); border-style: dashed; opacity: 0.6;";
        }
        if (!isSelected) styleStr += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
      } else if (hasLaterPrerequisites) {
        styleStr += "background: rgb(var(--node-locked-bg)); border-color: rgb(239 68 68); color: rgb(var(--node-locked-text)); border-style: dashed; border-width: 3px; opacity: 0.8;";
        if (!isSelected) styleStr += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
      } else if (s === "completed") {
        styleStr += "background: rgb(var(--node-completed-bg)); border-color: rgb(var(--node-completed-border)); color: rgb(var(--text-primary)); ";
        if (!isSelected) styleStr += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
      } else if (isAttended) {
        styleStr += "background: rgb(var(--node-attended-bg)); border-color: rgb(var(--node-attended-border)); color: rgb(var(--text-primary)); ";
        if (!isSelected) styleStr += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
      } else if (s === "available") {
        styleStr += "background: rgb(var(--node-available-bg)); border-color: rgb(var(--node-available-border)); color: rgb(var(--text-primary)); ";
        if (!isSelected) styleStr += "box-shadow: 0 1px 2px rgba(0,0,0,0.05);";
      } else {
        styleStr += "background: rgb(var(--node-locked-bg)); border-color: rgb(var(--node-locked-border)); color: rgb(var(--node-locked-text)); opacity: 0.6;";
      }
      return { 
        ...n, 
        style: styleStr,
        data: {
          ...data,
          showCourseTypeBadges: showCourseTypeBadges()
        }
      };
    });
  });

  const styledEdges = $derived.by(() => {
    const statuses = computeStatuses(currentTemplate(), userSelections(), slotStatusMap());
    return edges().map((e) => {
      let selectedSlotId = selection()?.id;
      if (selection() && !selection()!.id.startsWith('elective') && !selection()!.id.startsWith('major')) {
        const selectedSlot = currentTemplate().slots.find(slot => slot.courseId === selection()!.id);
        selectedSlotId = selectedSlot?.id;
      }
      
      const isSelected = selectedSlotId === e.source || selectedSlotId === e.target;
      const isPrerequisite = selectedSlotId === e.target;
      const isDependent = selectedSlotId === e.source;
      
      const sourceSlot = currentTemplate().slots.find((slot: any) => slot.id === e.source);
      const sourceCompleted = sourceSlot ? progressStore.getSlotStatus(sourceSlot.id) === 'completed' : false;

      const targetSlot = currentTemplate().slots.find((slot: any) => slot.id === e.target);
      const targetCompleted = targetSlot ? progressStore.getSlotStatus(targetSlot.id) === 'completed' : false;
      
      let edgeStyle = "stroke-width: 2px; ${!isDragging ? 'transition: all 0.2s;' : ''}; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1)); ";
      let markerEnd = e.markerEnd;
      let animated = false;
      
      if (isSelected) {
        if (isPrerequisite) {
          edgeStyle += "stroke: rgb(245 158 11); stroke-width: 3px; stroke-dasharray: 5,5; ";
          markerEnd = { type: (isMarkerEnd(markerEnd) ? markerEnd.type : MarkerType.ArrowClosed), color: "rgb(245 158 11)" };
        } else if (isDependent) {
          edgeStyle += "stroke: rgb(59 130 246); stroke-width: 3px; ";
          markerEnd = { type: (isMarkerEnd(markerEnd) ? markerEnd.type : MarkerType.ArrowClosed), color: "rgb(59 130 246)" };
        }
      } else {
        if (sourceCompleted && targetCompleted) {
          edgeStyle += "stroke: rgb(34 197 94); stroke-width: 3px; ";
          markerEnd = { type: (isMarkerEnd(markerEnd) ? markerEnd.type : MarkerType.ArrowClosed), color: "rgb(34 197 94)" };
        }
        else if (sourceCompleted) {
          edgeStyle += "stroke: rgb(34 197 94); stroke-width: 3px; ";
          markerEnd = { type: (isMarkerEnd(markerEnd) ? markerEnd.type : MarkerType.ArrowClosed), color: "rgb(34 197 94)" };
          animated = true;
        }
        else {
          edgeStyle += "stroke: rgb(var(--border-primary)); stroke-opacity: 0.6; ";
          markerEnd = { type: (isMarkerEnd(markerEnd) ? markerEnd.type : MarkerType.ArrowClosed) };
        }
      }
      
      return {
        ...e,
        animated: animated || (statuses[e.target as string] === "available" && !sourceCompleted),
        style: edgeStyle,
        markerEnd,
      };
    });
  });

  const handleMove: OnMove = (_event, viewportData) => {
    uiStore.updateViewport(viewportData);
  };

  const handleNodeDragStart: NodeTargetEventWithPointer<MouseEvent | TouchEvent> = ({ targetNode }) => {
    if (!targetNode) return;
    isDragging = true;
    courseStore.handleNodeDragStart(targetNode.id);
  };

  const handleNodeDrag: NodeTargetEventWithPointer<MouseEvent | TouchEvent> = ({ targetNode }) => {
    if (!targetNode) return;
    const position = (targetNode as any).positionAbsolute || targetNode.position || { x: 0, y: 0 };
    courseStore.handleNodeDrag(targetNode.id, position);
  };

  const handleNodeDragStop: NodeTargetEventWithPointer<MouseEvent | TouchEvent> = ({ targetNode }) => {
    if (!targetNode) return;
    isDragging = false;
    const position = (targetNode as any).positionAbsolute || targetNode.position || { x: 0, y: 0 };
    courseStore.handleNodeDragStop(targetNode.id, position);
  };

  function handleNodeClick(evt: { node: any; event: MouseEvent | TouchEvent }) {
    const node = evt.node;
    if (!node) return;

    const data = node.data;
    const slot = data.slot;
    const course = data.course;
    const isElectiveSlot = data.isElectiveSlot;

    if (isElectiveSlot && slot) {
      const electiveCourse: Course = {
        id: slot.id,
        label: slot.type === 'elective' ? 'Wahl-Modul' : slot.type === 'major' ? 'Major-Modul' : 'Course',
        ects: 0,
        prerequisites: [],
        type: slot.type === "major" ? "Major-/Minormodul" : "Erweiterungsmodul"
      };
      uiStore.selectCourse(electiveCourse, slot.id);
    } else if (course && slot) {
      uiStore.selectCourse(course, slot.id);
    }
  }

  onMount(() => {
    courseStore.init();
    progressStore.init();
    uiStore.init();
  });
</script>

<div class="relative">
  <SvelteFlow
    nodes={styledNodes}
    edges={styledEdges}
    {nodeTypes}
    onnodeclick={handleNodeClick}
    onnodedragstart={handleNodeDragStart}
    onnodedrag={handleNodeDrag}
    onnodedragstop={handleNodeDragStop}
    onmove={handleMove}
    nodesDraggable={true}
    nodesConnectable={false}
    fitView
    colorMode={theme() === 'system' ? 'system' : theme()}
    >
    <svg class="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
      <g transform="translate({viewport().x}, {viewport().y}) scale({viewport().zoom})">
        {#each semesterNumbers as sem}
          <SemesterDivider
            semester={sem}
            viewport={viewport()}
            currentTemplate={currentTemplate()}
            userSelections={userSelections()}
          />
        {/each}
      </g>
    </svg>
    <MiniMap />
    <Controls />
    <Background gap={16} />
  </SvelteFlow>
  
  <DisclaimerToast />
</div>
