<script lang="ts">
  import { onMount } from "svelte";
  import {
    SvelteFlow,
    Background,
    Controls,
    type NodeTargetEventWithPointer,
    useViewport,
  } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";
  
  import {
    nodes,
    edges,
    studyPlan,
    userSelections,
    courseStore,
    semesterDividerData
  } from '$lib/stores/courseStore.svelte';
  import {
    selection,
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
  let hideAttribution = $state(false);

  const viewportSignal = useViewport();
  const viewport = $derived(viewportSignal.current);
  const semesterIndicators = $derived.by(() => semesterDividerData());

  const styledNodes = $derived.by(() => {
    const statuses = computeStatuses(studyPlan(), slotStatusMap());

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
    const statuses = computeStatuses(studyPlan(), slotStatusMap());
    
    return edges().map((e) => {
      const { style, markerEnd, animated } = getEdgeStyle(
        e,
        selection(),
        statuses,
        slotStatusMap(),
        studyPlan(),
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

    const mediaQuery = window.matchMedia('(max-width: 1024px)');
    const handleScreenChange = () => {
      hideAttribution = mediaQuery.matches;
    };
    handleScreenChange();
    mediaQuery.addEventListener('change', handleScreenChange);

    return () => {
      mediaQuery.removeEventListener('change', handleScreenChange);
    };
  });
</script>

<div class="relative h-full min-h-0">
  <SvelteFlow
    nodes={styledNodes}
    edges={styledEdges}
    {nodeTypes}
    onnodeclick={handleNodeClick}
    onnodedragstart={handleNodeDragStart}
    onnodedrag={handleNodeDrag}
    onnodedragstop={handleNodeDragStop}
    nodesDraggable={true}
    nodesConnectable={false}
    fitView
    colorMode={theme() === 'system' ? 'system' : theme()}
    proOptions={{ hideAttribution }}
    >
    <svg class="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
      <g transform="translate({viewport.x}, {viewport.y}) scale({viewport.zoom})">
        {#each semesterIndicators as divider}
          <SemesterDivider
            semester={divider.semester}
            plan={studyPlan()}
            isPreview={divider.isPreview}
            length={divider.length}
          />
        {/each}
      </g>
    </svg>
    <Controls />
    <Background gap={16} />
  </SvelteFlow>
  
  <DisclaimerToast />
</div>
