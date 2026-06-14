<script lang="ts">
  import { onMount } from 'svelte';
  import { courseStore } from '$lib/stores/courseStore.svelte';
  import { slotStatusMap } from '$lib/stores/progressStore.svelte';
  import { computeCategoryProgress } from '$lib/data/analytics';
  import { getEctsRequirements } from '$lib/data/ects-requirements';

  let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();

  function close() {
    isOpen = false;
  }

  const program = $derived(courseStore.currentTemplate.studiengang);
  const requiredTotal = $derived(getEctsRequirements(program)?.total ?? 0);
  const passed = $derived(courseStore.completedCredits);
  const failed = $derived(courseStore.attendedCredits);
  const plannedRemaining = $derived(Math.max(0, courseStore.totalCredits - passed - failed));
  const categories = $derived.by(() =>
    computeCategoryProgress(courseStore.studyPlan, slotStatusMap(), program)
  );

  function widths(done: number, projected: number, required: number) {
    const denom = required || done + projected || 1;
    const passedPct = Math.min(100, (done / denom) * 100);
    const plannedPct = Math.min(100 - passedPct, (projected / denom) * 100);
    return { passedPct, plannedPct };
  }

  onMount(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) close();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  });
</script>

{#snippet bar(done: number, projected: number, required: number)}
  {@const w = widths(done, projected, required)}
  <div class="h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex">
    <div class="bg-green-500" style="width: {w.passedPct}%"></div>
    <div class="bg-blue-500/60" style="width: {w.plannedPct}%"></div>
  </div>
{/snippet}

<!-- backdrop -->
<div
  class="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 {isOpen
    ? 'opacity-100 pointer-events-auto'
    : 'opacity-0 pointer-events-none'}"
  onclick={close}
  aria-hidden={!isOpen}
></div>

<!-- panel -->
<aside
  class="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-bg-primary border-l border-border-primary shadow-2xl overflow-y-auto transition-transform duration-200 ease-out {isOpen
    ? 'translate-x-0'
    : 'translate-x-full pointer-events-none'}"
  aria-hidden={!isOpen}
>
  <div class="flex flex-col h-full">
    <div class="flex items-start justify-between p-6">
      <div>
        <h2 class="text-lg font-semibold text-text-primary mb-1">Progress</h2>
        <p class="text-sm text-text-secondary">Credit accumulation toward graduation</p>
      </div>
      <button
        onclick={close}
        class="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-bg-secondary transition-colors text-text-primary flex-shrink-0"
        aria-label="Close progress"
      >
        <div class="i-lucide-x h-4 w-4"></div>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <div class="flex items-baseline justify-between mb-2">
          <span class="text-base font-bold text-text-primary">Overall</span>
          <span class="text-sm text-text-secondary">{passed} / {requiredTotal} ECTS</span>
        </div>
        {@render bar(passed, plannedRemaining, requiredTotal)}
        <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-text-secondary">
          <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-green-500"></span>Passed {passed}</div>
          <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-blue-500/60"></span>Planned {plannedRemaining}</div>
          {#if failed > 0}
            <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>Failed {failed}</div>
          {/if}
        </div>
      </div>

      <div class="border-b border-border-primary"></div>

      <div class="space-y-4">
        <span class="text-base font-bold text-text-primary">By module type</span>
        {#each categories as category (category.category)}
          <div>
            <div class="flex items-baseline justify-between mb-1.5">
              <span class="text-sm text-text-primary">{category.category}</span>
              <span class="text-xs text-text-secondary">{category.passed} / {category.required} ECTS</span>
            </div>
            {@render bar(category.passed, category.planned, category.required)}
          </div>
        {/each}
      </div>
    </div>
  </div>
</aside>
