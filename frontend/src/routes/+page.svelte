<script lang="ts">
import { SvelteFlowProvider } from '@xyflow/svelte';
import { onMount } from 'svelte';
import SkillTreeCanvas from '$lib/components/canvas/SkillTreeCanvas.svelte';
import Header from '$lib/components/header/Header.svelte';
import CourseDetailsPanel from '$lib/components/sidebar/CourseDetailsPanel.svelte';
import StatusLegend from '$lib/components/sidebar/StatusLegend.svelte';
import AssessmentInfo from '$lib/components/ui/AssessmentInfo.svelte';
import SyncConflictDialog from '$lib/components/ui/SyncConflictDialog.svelte';
import { catalogAssetUrl, loadCatalog } from '$lib/data/catalog-loader';
import {
	collectAppData,
	hasMeaningfulStoredAppData,
} from '$lib/data/persistence';
import * as m from '$lib/paraglide/messages';
import { cloudSyncStore } from '$lib/stores/cloudSyncStore.svelte';
import { initializeCourseStore } from '$lib/stores/courseStore.svelte';
import { localeStore } from '$lib/stores/locale.svelte';
import { progressStore } from '$lib/stores/progressStore.svelte';
import { themeStore } from '$lib/stores/theme.svelte';
import { hasSelection, uiStore } from '$lib/stores/uiStore.svelte';

type StartupPhase = 'catalog' | 'progress' | 'ready' | 'catalog-error';

let legendOpen = $state(false);
let phase = $state<StartupPhase>('catalog');

async function startFromCatalog(): Promise<void> {
	localeStore.init();

	try {
		await loadCatalog();
		phase = 'progress';
	} catch (error) {
		console.error('Failed to load course catalog', error);
		phase = 'catalog-error';
		return;
	}

	// Detect meaningful local state before any store initializer mutates it.
	const localDataIsMeaningful = hasMeaningfulStoredAppData();
	const courseStore = initializeCourseStore();
	courseStore.init();
	themeStore.init();
	progressStore.init();
	uiStore.init();
	await cloudSyncStore.init(localDataIsMeaningful);
	phase = 'ready';
}

function retryCatalog(): void {
	phase = 'catalog';
	startFromCatalog();
}

onMount(() => {
	startFromCatalog();
});

// One root snapshot effect: every reactive store change flows through the
// sync store's baseline comparison and debounced cloud write. Import and
// reset actions land here too, batched into a single PUT.
$effect(() => {
	if (phase !== 'ready') return;
	cloudSyncStore.recordLocalSnapshot(collectAppData());
});

$effect(() => {
	if (hasSelection()) {
		legendOpen = false;
	}
});
</script>

{#if phase === 'catalog' || phase === 'progress'}
  <div class="flex h-screen items-center justify-center font-sans">
    <p class="text-sm text-text-secondary" role="status" aria-live="polite">
      {phase === 'catalog' ? m.page_loading_catalog() : m.page_loading_progress()}
    </p>
  </div>
{:else if phase === 'catalog-error'}
  <div class="flex h-screen items-center justify-center font-sans">
    <div class="flex flex-col items-center gap-4 text-center px-6">
      <h1 class="text-lg font-semibold text-text-primary">{m.page_catalog_unavailable_title()}</h1>
      <p class="text-sm text-text-secondary">{m.page_catalog_unavailable_text()}</p>
      <button
        type="button"
        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        onclick={retryCatalog}
      >
        {m.common_retry()}
      </button>
    </div>
  </div>
{:else}
  <div class="font-sans h-screen h-dvh overflow-hidden flex flex-col">
    <Header />
    
    <SvelteFlowProvider>
      <div class="flex-1 min-h-0 lg:grid lg:grid-cols-[1fr_400px]">
        <SkillTreeCanvas />
        <CourseDetailsPanel />
      </div>
    </SvelteFlowProvider>
    
    <!-- assessment info modal -->
    <AssessmentInfo />

    <div class="lg:hidden fixed bottom-4 right-4 z-30 w-72 max-w-[90vw]">
      <div class={`rounded-2xl border border-border-primary bg-bg-primary shadow-2xl backdrop-blur transition-all duration-300 overflow-hidden flex flex-col-reverse ${legendOpen ? 'max-h-96' : 'max-h-14'}`}>
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 px-4 py-3 text-text-primary"
          aria-label={m.legend_toggle()}
          aria-pressed={legendOpen}
          onclick={() => legendOpen = !legendOpen}
        >
          <div class="flex items-center gap-2">
            <div class="i-lucide-info w-4 h-4"></div>
            <span class="text-sm font-medium">{m.legend_button()}</span>
          </div>
          {#if legendOpen}
            <div class="i-lucide-chevron-down h-4 w-4 text-text-secondary"></div>
          {:else}
            <div class="i-lucide-chevron-up h-4 w-4 text-text-secondary"></div>
          {/if}
        </button>
        <div class="px-4 pb-4 pt-3 border-b border-border-primary" inert={!legendOpen}>
          <div class="[&>div:first-child]:border-t-0 [&>div:first-child]:pt-0">
            <StatusLegend />
          </div>
        </div>
      </div>

    </div>
  </div>
{/if}

<svelte:head>
	<link rel="preload" as="fetch" type="application/json" href={catalogAssetUrl} crossorigin="anonymous" />
</svelte:head>

<!-- sync conflict dialog renders even while the app is gated -->
<SyncConflictDialog />
