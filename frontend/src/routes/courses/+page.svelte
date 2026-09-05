<script lang="ts">
import { onMount } from 'svelte';
import AccountMenu from '$lib/components/header/AccountMenu.svelte';
import SettingsSidebar from '$lib/components/sidebar/SettingsSidebar.svelte';
import Tooltip from '$lib/components/ui/Tooltip.svelte';
import { loadCatalog } from '$lib/data/catalog-loader';
import type { CatalogCourse } from '$lib/data/catalog-types';
import { courseLabel } from '$lib/data/course-label';
import {
	collectAppData,
	hasMeaningfulStoredAppData,
} from '$lib/data/persistence';
import * as m from '$lib/paraglide/messages';
import { cloudSyncStore } from '$lib/stores/cloudSyncStore.svelte';
import { initializeCourseStore } from '$lib/stores/courseStore.svelte';
import { progressStore } from '$lib/stores/progressStore.svelte';
import { uiStore } from '$lib/stores/uiStore.svelte';

type Phase = 'loading' | 'ready' | 'error';

let phase = $state<Phase>('loading');
let courses = $state<CatalogCourse[]>([]);
let settingsOpen = $state(false);

async function load(): Promise<void> {
	phase = 'loading';
	try {
		const catalog = await loadCatalog();
		courses = catalog.courses;
		// The settings sidebar and account menu need the same stores as the
		// Skill Tree page, without its study-plan specific header controls.
		const localDataIsMeaningful = hasMeaningfulStoredAppData();
		initializeCourseStore().init();
		progressStore.init();
		uiStore.init();
		await cloudSyncStore.init(localDataIsMeaningful);
		phase = 'ready';
	} catch (error) {
		console.error('Failed to load course catalog', error);
		phase = 'error';
	}
}

// Keep cloud sync in sync when settings actions mutate study plan or
// progress, mirroring the Skill Tree page snapshot effect.
$effect(() => {
	if (phase !== 'ready') return;
	cloudSyncStore.recordLocalSnapshot(collectAppData());
});

onMount(() => {
	load();
});
</script>

<svelte:head>
	<title>Course Browser</title>
	<meta
		name="description"
		content="Browse all HSLU courses as a catalogue list."
	/>
</svelte:head>

{#if phase === 'loading'}
	<div class="flex min-h-screen items-center justify-center font-sans">
		<p class="text-text-secondary" role="status">Loading courses…</p>
	</div>
{:else if phase === 'error'}
	<div class="flex min-h-screen items-center justify-center font-sans">
		<p class="text-text-primary" role="alert">
			Could not load the course catalogue.
			<button type="button" class="underline" onclick={load}>
				Try again
			</button>
		</p>
	</div>
{:else}
	<div class="flex min-h-screen min-h-dvh flex-col bg-bg-primary font-sans text-text-primary">
		<header class="border-b border-border-primary bg-bg-primary px-4 py-2 sm:py-3">
			<div class="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
				<a
					href="/"
					class="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-text-secondary transition-all hover:bg-bg-secondary hover:text-text-primary"
				>
					<div class="i-lucide-arrow-left h-4 w-4 shrink-0"></div>
					<span class="truncate">{m.nav_skill_tree()}</span>
				</a>
				<div class="flex shrink-0 items-center gap-2">
					<AccountMenu onInteract={() => (settingsOpen = false)} />
					<Tooltip text={m.header_settings_help()} align="end">
						<button
							onclick={(event) => {
								settingsOpen = !settingsOpen;
								event.currentTarget.blur();
							}}
							class="flex cursor-pointer items-center justify-center w-8 h-8 rounded-lg hover:bg-bg-secondary hover:shadow-sm transition-all text-text-primary"
							aria-label={m.header_settings_help()}
						>
							<div class="i-lucide-settings h-4 w-4 text-text-primary"></div>
						</button>
					</Tooltip>
				</div>
			</div>
		</header>
		<SettingsSidebar
			isOpen={settingsOpen}
			onClose={() => (settingsOpen = false)}
		/>
		<main class="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
			<h1 class="text-2xl font-bold">Course Browser</h1>
			<p class="mt-1 text-sm text-text-secondary">
				A discovery-oriented catalogue of all HSLU courses, complementing the
				dependency-oriented Skill Tree.
			</p>

			<p class="mt-4 text-sm text-text-secondary">
				{courses.length} courses
			</p>
			<ul class="mt-2 grid gap-2 sm:grid-cols-2">
				{#each courses as course (course.id)}
					<li
						class="rounded-lg border border-border-primary bg-bg-secondary p-3"
					>
						<article class="flex items-start gap-3">
							<div class="i-lucide-book-open mt-0.5 shrink-0 text-text-tertiary"></div>
							<div class="min-w-0">
								<h2 class="truncate font-semibold">{courseLabel(course)}</h2>
								<p class="mt-0.5 text-sm text-text-secondary">
									{course.id} · {course.ects} ECTS
								</p>
							</div>
						</article>
					</li>
				{/each}
			</ul>
		</main>
	</div>
{/if}
