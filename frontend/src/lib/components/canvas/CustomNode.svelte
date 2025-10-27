<script lang="ts">
  import type { Course, TemplateSlot } from "$lib/data/courses";
  import { Handle, Position } from "@xyflow/svelte";
  import { studyPlan } from "$lib/stores/courseStore.svelte";
  import { progressStore } from "$lib/stores/progressStore.svelte";

  let {
    id,
    data = {},
    selected = false,
    width = 180,
    showRemoveButton = false,
    onRemove,
  }: {
    id: string;
    data: any;
    selected: boolean;
    width?: number;
    showRemoveButton?: boolean;
    onRemove?: (nodeId: string) => void;
  } = $props();

  type ExtendedNodeData = {
    label: string;
    slot?: TemplateSlot;
    course?: Course;
    courseId?: string;
    isElectiveSlot?: boolean;
    showCourseTypeBadges?: boolean;
    width?: number;
    sourceHandles?: number;
    targetHandles?: number;
    showRemoveButton?: boolean;
    onRemove?: (nodeId: string) => void;
  };

  const nodeData = $derived(data as ExtendedNodeData);
  const slot = $derived(nodeData.slot);
  const course = $derived(nodeData.course);
  const isElectiveSlot = $derived(nodeData.isElectiveSlot);
  const nodeWidth = $derived(nodeData.width || width);
  const sourceHandles = $derived(nodeData.sourceHandles ?? 0);
  const targetHandles = $derived(nodeData.targetHandles ?? 0);
  const showRemoveBtn = $derived(nodeData.showRemoveButton ?? showRemoveButton);
  const removeHandler = $derived(nodeData.onRemove ?? onRemove);

  const hasMissingPrerequisites = $derived.by(() => {
    const courseId = course?.id || nodeData.courseId;
    if (!courseId) return false;

    if (!course?.prerequisites || course.prerequisites.length === 0) return false;

    const status = progressStore.getSlotStatus(id);
    if (status !== 'completed' && status !== 'attended') return false;

    const plan = studyPlan();
    return course.prerequisites.some(rule => {
      const modulesInPlan = rule.modules.map(moduleId => 
        Object.values(plan.nodes).some(node => node.courseId === moduleId)
      );
      
      if (rule.moduleLinkType === 'oder') {
        return !modulesInPlan.some(Boolean);
      } else {
        return !modulesInPlan.every(Boolean);
      }
    });
  });

  function getCourseTypeColor(type?: string): string {
    switch (type) {
      case "Kernmodul":
        return "bg-blue-500";
      case "Projektmodul":
        return "bg-orange-500";
      case "Erweiterungsmodul":
        return "bg-green-500";
      case "Major-/Minormodul":
        return "bg-purple-500";
      case "Zusatzmodul":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  }

  function getCourseTypeLabel(type?: string): string {
    switch (type) {
      case "Kernmodul":
        return "Kern";
      case "Projektmodul":
        return "Projekt";
      case "Erweiterungsmodul":
        return "Wahl";
      case "Major-/Minormodul":
        return "Major/Minor";
      case "Zusatzmodul":
        return "Zusatz";
      default:
        return "Modul";
    }
  }

  function handleRemoveClick(event: MouseEvent) {
    event.stopPropagation();
    if (removeHandler) {
      removeHandler(id);
    }
  }
</script>

<div
  class="relative h-full w-full flex flex-col justify-between p-2"
  style="width: {nodeWidth}px; max-width: {nodeWidth}px;"
>
  <!-- Remove button -->
  {#if showRemoveBtn}
    <button
      class="absolute -top-3 -right-1 w-5 h-5 bg-red-500 text-white border-0 rounded-full cursor-pointer flex items-center justify-center z-10 transition-colors duration-200 hover:bg-red-600 active:bg-red-700"
      onclick={handleRemoveClick}
      aria-label="Remove {nodeData.label}"
      type="button"
    >
      <div class="i-lucide-x w-3.5 h-3.5"></div>
    </button>
  {/if}

  <!-- Missing prerequisite warning badge -->
  {#if hasMissingPrerequisites}
    <div
      class="absolute -top-2 -left-2 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center z-10 shadow-md"
      title="This course has missing prerequisites in your study plan"
    >
      <span class="text-white text-xs font-bold">!</span>
    </div>
  {/if}

  <!-- Source handles (bottom) -->
  {#if sourceHandles > 0}
    {#each Array(sourceHandles) as _, i}
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-{i}"
        style="left: {((i + 1) * 100) / (sourceHandles + 1)}%"
      />
    {/each}
  {/if}

  <!-- Target handles (top) -->
  {#if targetHandles > 0}
    {#each Array(targetHandles) as _, i}
      <Handle
        type="target"
        position={Position.Top}
        id="target-{i}"
        style="left: {((i + 1) * 100) / (targetHandles + 1)}%"
      />
    {/each}
  {/if}

  {#if nodeData.showCourseTypeBadges}
    {#if course?.type}
      <div>
        <div
          class="inline-block px-1.5 py-0.5 rounded-full text-xs font-medium text-white {getCourseTypeColor(
            course.type
          )} shadow-sm"
        >
          {getCourseTypeLabel(course.type)}
        </div>
      </div>
    {:else if isElectiveSlot}
      <div>
        <div
          class="inline-block px-1.5 py-0.5 rounded-full text-xs font-medium text-white bg-gray-500 shadow-sm"
        >
          Wahl
        </div>
      </div>
    {/if}
  {/if}

  <div
    class="p-2 text-sm font-medium text-text-primary flex-grow flex items-center justify-center text-center"
  >
    {nodeData.label}
  </div>
</div>

<style>
  :global(.node-content) {
    position: relative;
    z-index: 1;
  }
</style>
