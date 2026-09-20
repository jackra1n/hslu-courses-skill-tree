<script lang="ts">
import { Handle, type Node, type NodeProps, Position } from '@xyflow/svelte';
import ModuleTypeBadge from '$lib/components/ui/ModuleTypeBadge.svelte';
import type { ExtendedNodeData } from '$lib/data/courses';
import * as m from '$lib/paraglide/messages';

let {
	id,
	data: nodeData,
	width = 180,
}: NodeProps<Node<ExtendedNodeData, 'custom'>> = $props();

const course = $derived(nodeData.course);
const isElectiveSlot = $derived(nodeData.isElectiveSlot);
const nodeWidth = $derived(nodeData.width || width);
const sourceHandles = $derived(nodeData.sourceHandles ?? 0);
const targetHandles = $derived(nodeData.targetHandles ?? 0);
const showRemoveBtn = $derived(nodeData.showRemoveButton);

function handleRemoveClick(event: MouseEvent) {
	event.stopPropagation();
	nodeData.onRemove?.(id);
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
      aria-label={m.remove_course_aria({ label: nodeData.label ?? '' })}
      type="button"
    >
      <div class="i-lucide-x w-3.5 h-3.5"></div>
    </button>
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
    {@const moduleType = course?.type ?? (isElectiveSlot ? 'Erweiterungsmodul' : undefined)}
    {#if moduleType}
      <div>
        <ModuleTypeBadge type={moduleType} short variant="solid" />
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
