<script lang="ts">
import { SvelteFlowProvider } from '@xyflow/svelte';
import { onMount } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';
import { slide } from 'svelte/transition';
import SkillTreeCanvas from '$lib/components/canvas/SkillTreeCanvas.svelte';
import Header from '$lib/components/header/Header.svelte';
import CourseDetailsPanel from '$lib/components/sidebar/CourseDetailsPanel.svelte';
import StatusLegend from '$lib/components/sidebar/StatusLegend.svelte';
import GuidedTutorial from '$lib/components/ui/GuidedTutorial.svelte';
import { catalogAssetUrl, loadCatalog } from '$lib/data/catalog/catalog-loader';
import {
	collectAppData,
	hasMeaningfulStoredAppData,
} from '$lib/data/persistence';
import * as m from '$lib/paraglide/messages';
import { cloudSyncStore } from '$lib/stores/cloudSyncStore.svelte';
import { initializeCourseStore } from '$lib/stores/courseStore.svelte';
import { progressStore } from '$lib/stores/progressStore.svelte';
import { uiStore } from '$lib/stores/uiStore.svelte';

type StartupPhase = 'catalog' | 'progress' | 'ready' | 'catalog-error';

let legendOpen = $state(false);
const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
let phase = $state<StartupPhase>('catalog');

async function startFromCatalog(): Promise<void> {
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
	progressStore.init();
	uiStore.init();
	await cloudSyncStore.init(localDataIsMeaningful);
	phase = 'ready';
}

function handleStartupError(error: unknown): void {
	console.error('Failed to initialize study plan', error);
	phase = 'catalog-error';
}

function retryCatalog(): void {
	phase = 'catalog';
	startFromCatalog().catch(handleStartupError);
}

onMount(() => {
	startFromCatalog().catch(handleStartupError);
});

// One root snapshot effect: every reactive store change flows through the
// sync store's baseline comparison and debounced cloud write. Import and
// reset actions land here too, batched into a single PUT.
$effect(() => {
	if (phase !== 'ready') return;
	cloudSyncStore.recordLocalSnapshot(collectAppData());
});

$effect(() => {
	if (uiStore.hasSelection) {
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
			<h1 class="text-lg font-semibold text-text-primary">
				{m.page_catalog_unavailable_title()}
			</h1>
			<p class="text-sm text-text-secondary">
				{m.page_catalog_unavailable_text()}
			</p>
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
			<div class="flex-1 min-h-0 xl:grid xl:grid-cols-[1fr_400px]">
				<SkillTreeCanvas />
				<CourseDetailsPanel />
			</div>
		</SvelteFlowProvider>

		<GuidedTutorial />

		<div class="xl:hidden fixed bottom-4 right-4 z-30 w-72 max-w-[90vw]">
			<div
				class="rounded-2xl border border-border-primary bg-bg-primary shadow-2xl overflow-hidden flex flex-col-reverse"
			>
				<button
					type="button"
					class="flex min-h-11 w-full shrink-0 items-center justify-between gap-2 px-4 py-3 text-text-primary"
					aria-label={m.legend_toggle()}
					aria-expanded={legendOpen}
					aria-controls="mobile-status-legend"
					onclick={() => legendOpen = !legendOpen}
				>
					<div class="flex items-center gap-2">
						<div class="i-lucide-info w-4 h-4"></div>
						<span class="text-sm font-medium">{m.legend_button()}</span>
					</div>
					{#if legendOpen}
						<div
							class="i-lucide-chevron-down h-4 w-4 text-text-secondary"
						></div>
					{:else}
						<div class="i-lucide-chevron-up h-4 w-4 text-text-secondary"></div>
					{/if}
				</button>
				{#if legendOpen}
					<div
						id="mobile-status-legend"
						transition:slide={{ duration: reducedMotion.current ? 0 : 200 }}
						class="max-h-80 overflow-y-auto px-4 pb-4 pt-3 border-b border-border-primary"
					>
						<div
							class="[&>div:first-child]:border-t-0 [&>div:first-child]:pt-0"
						>
							<StatusLegend />
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<svelte:head>
	<link
		rel="preload"
		as="fetch"
		type="application/json"
		href={catalogAssetUrl}
		crossorigin="anonymous"
	>
</svelte:head>
