<script lang="ts">
import Sidebar from '$lib/components/ui/Sidebar.svelte';
import { computeCategoryProgress } from '$lib/data/analytics';
import { getEctsRequirements } from '$lib/data/ects-requirements';
import { moduleTypeLabel } from '$lib/data/module-type';
import * as messages from '$lib/paraglide/messages';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import { slotStatusMap } from '$lib/stores/progressStore.svelte';

let { isOpen, onClose }: { isOpen: boolean; onClose: () => void } = $props();

function close() {
	onClose();
}

const courseStore = getCourseStore();

const program = $derived(courseStore.currentTemplate.studiengang);
const requiredTotal = $derived(getEctsRequirements(program)?.total ?? 0);
const passed = $derived(courseStore.completedCredits);
const failed = $derived(courseStore.attendedCredits);
const plannedRemaining = $derived(
	Math.max(0, courseStore.totalCredits - passed - failed),
);
const categories = $derived.by(() =>
	computeCategoryProgress(courseStore.studyPlan, slotStatusMap(), program),
);

function widths(done: number, projected: number, required: number) {
	const denom = required || done + projected || 1;
	const passedPct = Math.min(100, (done / denom) * 100);
	const plannedPct = Math.min(100 - passedPct, (projected / denom) * 100);
	return { passedPct, plannedPct };
}
</script>

{#snippet bar(done: number, projected: number, required: number)}
  {@const w = widths(done, projected, required)}
  <div class="h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex">
    <div class="bg-green-500" style="width: {w.passedPct}%"></div>
    <div class="bg-blue-500/60" style="width: {w.plannedPct}%"></div>
  </div>
{/snippet}

<Sidebar {isOpen} {onClose} label={messages.analytics_title()}>
  <div class="flex h-full flex-col">
    <div class="flex items-start justify-between p-6">
      <div>
        <h2 class="text-lg font-semibold text-text-primary mb-1">{messages.analytics_title()}</h2>
        <p class="text-sm text-text-secondary">{messages.analytics_subtitle()}</p>
      </div>
      <button
        onclick={close}
        aria-label={messages.analytics_close()}
      >
        <div class="i-lucide-x h-4 w-4"></div>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <div class="flex items-baseline justify-between mb-2">
          <span class="text-base font-bold text-text-primary">{messages.analytics_overall()}</span>
          <span class="text-sm text-text-secondary">{passed} / {requiredTotal} ECTS</span>
        </div>
        {@render bar(passed, plannedRemaining, requiredTotal)}
        <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-text-secondary">
          <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-green-500"></span>{messages.analytics_passed({ count: passed })}</div>
          <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-blue-500/60"></span>{messages.analytics_planned({ count: plannedRemaining })}</div>
          {#if failed > 0}
            <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>{messages.analytics_failed({ count: failed })}</div>
          {/if}
        </div>
      </div>

      <div class="border-b border-border-primary"></div>

      <div class="space-y-4">
        <span class="text-base font-bold text-text-primary">{messages.analytics_by_module_type()}</span>
        {#each categories as category (category.category)}
          <div>
            <div class="flex items-baseline justify-between mb-1.5">
              <span class="text-sm text-text-primary">{moduleTypeLabel(category.category)}</span>
              <span class="text-xs text-text-secondary">{category.passed} / {category.required} ECTS</span>
            </div>
            {@render bar(category.passed, category.planned, category.required)}
            {#each category.subcategories ?? [] as sub (sub.category)}
              <div class="mt-2 pl-4 border-l border-border-primary">
                <div class="flex items-baseline justify-between mb-1.5">
                  <span class="text-xs text-text-secondary">↳ {moduleTypeLabel(sub.category)}</span>
                  <span class="text-xs text-text-secondary">{sub.passed} / {sub.required} ECTS</span>
                </div>
                {@render bar(sub.passed, sub.planned, sub.required)}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  </div>
</Sidebar>
