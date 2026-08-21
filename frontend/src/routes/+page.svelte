<script lang="ts">
import { SvelteFlowProvider } from '@xyflow/svelte';
import { onMount } from 'svelte';
import SkillTreeCanvas from '$lib/components/canvas/SkillTreeCanvas.svelte';
import Header from '$lib/components/header/Header.svelte';
import CourseDetailsPanel from '$lib/components/sidebar/CourseDetailsPanel.svelte';
import StatusLegend from '$lib/components/sidebar/StatusLegend.svelte';
import AssessmentInfo from '$lib/components/ui/AssessmentInfo.svelte';
import SyncConflictDialog from '$lib/components/ui/SyncConflictDialog.svelte';
import {
	collectAppData,
	hasMeaningfulStoredAppData,
} from '$lib/data/persistence';
import { cloudSyncStore } from '$lib/stores/cloudSyncStore.svelte';
import {
	getCourseStore,
	initializeCourseStore,
} from '$lib/stores/courseStore.svelte';
import { progressStore } from '$lib/stores/progressStore.svelte';
import { themeStore } from '$lib/stores/theme.svelte';
import { hasSelection, uiStore } from '$lib/stores/uiStore.svelte';

let legendOpen = $state(false);
let appReady = $state(false);

onMount(async () => {
	// Detect meaningful local state before any store initializer mutates it.
	const localDataIsMeaningful = hasMeaningfulStoredAppData();
	themeStore.init();
	const courseStore = initializeCourseStore();
	courseStore.init();
	progressStore.init();
	uiStore.init();
	await cloudSyncStore.init(localDataIsMeaningful);
	appReady = true;
});

// One root snapshot effect: every reactive store change flows through the
// sync store's baseline comparison and debounced cloud write. Import and
// reset actions land here too, batched into a single PUT.
$effect(() => {
	if (!appReady) return;
	cloudSyncStore.recordLocalSnapshot(collectAppData());
});

$effect(() => {
	if (hasSelection()) {
		legendOpen = false;
	}
});
</script>

{#if !appReady}
  <div class="flex h-screen items-center justify-center font-sans">
    <p class="text-sm text-text-secondary">Loading your progress…</p>
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
          aria-label="Toggle status legend"
          aria-pressed={legendOpen}
          onclick={() => legendOpen = !legendOpen}
        >
          <div class="flex items-center gap-2">
            <div class="i-lucide-info w-4 h-4"></div>
            <span class="text-sm font-medium">Legend</span>
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

<!-- sync conflict dialog renders even while the app is gated -->
<SyncConflictDialog />
