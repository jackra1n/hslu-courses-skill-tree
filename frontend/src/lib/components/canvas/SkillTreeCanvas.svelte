<script lang="ts">
  import { onMount } from "svelte";
  import {
    SvelteFlow,
    Background,
    Controls,
    MiniMap,
    type OnMove,
    type NodeTargetEventWithPointer,
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
  import { computeStatuses, getNodeStyle, getEdgeStyle } from '$lib/utils/status';
  import { getNodeWidth } from '$lib/utils/layout';

  import type { Course } from '$lib/types';

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
      const status = statuses[n.id];
      const data = n.data as any;
      const slot = data.slot;
      const course = data.course;
      const isElectiveSlot = data.isElectiveSlot;

      const slotStatus = slot ? progressStore.getSlotStatus(slot.id) : null;
      const isAttended = slotStatus === 'attended';
      const isCompleted = slotStatus === 'completed';

      const isSelected = selection()?.id === n.id || (course && selection()?.id === course.id);
      
      const nodeWidth = data.width || getNodeWidth(course?.ects || slot?.credits || 6);
      
      const hasSelectedCourse = isElectiveSlot && slot 
        ? !!userSelections()[slot.id] 
        : false;
      
      const hasLaterPrerequisites = data.hasLaterPrerequisites || false;
      
      const styleStr = getNodeStyle(
        status,
        isSelected,
        isAttended,
        isCompleted,
        isElectiveSlot,
        nodeWidth,
        hasSelectedCourse,
        hasLaterPrerequisites,
        isDragging
      );
      
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
      const { style, markerEnd, animated } = getEdgeStyle(
        e,
        selection(),
        statuses,
        slotStatusMap(),
        currentTemplate(),
        isDragging
      );
      
      return {
        ...e,
        style,
        markerEnd,
        animated
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
