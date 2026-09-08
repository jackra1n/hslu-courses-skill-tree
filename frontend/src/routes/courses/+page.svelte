<script lang="ts">
import { onMount } from 'svelte';
import AccountMenu from '$lib/components/header/AccountMenu.svelte';
import SettingsSidebar from '$lib/components/sidebar/SettingsSidebar.svelte';
import Tooltip from '$lib/components/ui/Tooltip.svelte';
import { loadCatalog } from '$lib/data/catalog-loader';
import type { CatalogCourse, ModuleType } from '$lib/data/catalog-types';
import {
	type EctsRange,
	EMPTY_FILTERS,
	filterCourses,
	isFiltering,
} from '$lib/data/course-filters';
import {
	collectAppData,
	hasMeaningfulStoredAppData,
} from '$lib/data/persistence';
import { type Season } from '$lib/data/season';
import * as m from '$lib/paraglide/messages';
import { cloudSyncStore } from '$lib/stores/cloudSyncStore.svelte';
import { initializeCourseStore } from '$lib/stores/courseStore.svelte';
import { progressStore } from '$lib/stores/progressStore.svelte';
import { uiStore } from '$lib/stores/uiStore.svelte';
import CourseRow from './CourseRow.svelte';
import FilterSidebar from './FilterSidebar.svelte';

type Phase = 'loading' | 'ready' | 'error';

let phase = $state<Phase>('loading');
let courses = $state<CatalogCourse[]>([]);
let settingsOpen = $state(false);

let query = $state(EMPTY_FILTERS.query);
let season = $state<Season | 'all'>(EMPTY_FILTERS.season);
let moduleType = $state<ModuleType | 'all'>(EMPTY_FILTERS.moduleType);
let ects = $state<EctsRange>(EMPTY_FILTERS.ects);
let sidebarOpen = $state(false);
const filters = $derived({ query, season, moduleType, ects });
const filteredCourses = $derived(filterCourses(courses, filters));
const filtering = $derived(isFiltering(filters));
const activeFilterCount = $derived(
	(query.trim() !== '' ? 1 : 0) +
		(season !== 'all' ? 1 : 0) +
		(moduleType !== 'all' ? 1 : 0) +
		(ects !== null ? 1 : 0),
);
// Slider stops are the distinct ECTS values in the catalog, so every stop
// matches real courses.
const ectsSteps = $derived(
	[...new Set(courses.map((course) => course.ects))].sort((a, b) => a - b),
);

function clearFilters(): void {
	query = EMPTY_FILTERS.query;
	season = EMPTY_FILTERS.season;
	moduleType = EMPTY_FILTERS.moduleType;
	ects = EMPTY_FILTERS.ects;
}

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
		<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
			<h1 class="text-2xl font-bold">Course Browser</h1>
			<p class="mt-1 text-sm text-text-secondary">
				A discovery-oriented catalogue of all HSLU courses, complementing the
				dependency-oriented Skill Tree.
			</p>

			<div role="search" class="relative mt-4">
				<div
					class="i-lucide-search pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
					aria-hidden="true"
				></div>
				<input
					id="course-search"
					type="text"
					inputmode="search"
					bind:value={query}
					placeholder={m.elective_search()}
					aria-label={m.browser_search_label()}
					class="h-10 w-full rounded-lg border border-border-primary bg-bg-secondary pl-9 pr-9 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				{#if query}
					<button
						type="button"
						onclick={() => (query = '')}
						aria-label={m.common_clear()}
						class="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-all hover:bg-bg-primary hover:text-text-primary"
					>
						<div class="i-lucide-x h-4 w-4" aria-hidden="true"></div>
					</button>
				{/if}
			</div>
			<button
				type="button"
				onclick={() => (sidebarOpen = !sidebarOpen)}
				aria-expanded={sidebarOpen}
				class="mt-3 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border-primary bg-bg-secondary px-3 text-sm font-medium text-text-primary lg:hidden"
			>
				<span
					class="i-lucide-sliders-horizontal h-4 w-4 text-text-tertiary"
					aria-hidden="true"
				></span>
				{m.browser_filters()}
				{#if activeFilterCount > 0}
					<span
						class="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-semibold text-white"
					>
						{activeFilterCount}
					</span>
				{/if}
				<span
					class="i-lucide-chevron-down h-4 w-4 text-text-tertiary transition-transform {sidebarOpen
						? 'rotate-180'
						: ''}"
					aria-hidden="true"
				></span>
			</button>
			<div class="mt-3 lg:flex lg:items-start lg:gap-6">
				<div class="{sidebarOpen ? 'block' : 'hidden'} lg:block lg:w-64 lg:shrink-0">
					<div class="lg:sticky lg:top-4">
						<FilterSidebar
							bind:season
							bind:moduleType
							bind:ects
							{ectsSteps}
						/>
					</div>
				</div>
				<div class="mt-4 min-w-0 flex-1 lg:mt-0">
					<div class="flex items-center justify-between gap-3">
						<p class="text-sm text-text-secondary" aria-live="polite">
							{#if !filtering}
								{m.browser_count_all({ total: courses.length })}
							{:else}
								{m.browser_count_filtered({ filtered: filteredCourses.length, total: courses.length })}
							{/if}
						</p>
						{#if filtering}
							<button
								type="button"
								onclick={clearFilters}
								class="shrink-0 cursor-pointer text-sm font-medium text-text-primary underline"
							>
								{m.common_clear()}
							</button>
						{/if}
					</div>
					{#if filteredCourses.length === 0}
						<div
							class="mt-2 rounded-lg border border-border-primary bg-bg-secondary p-6 text-center"
						>
							<p class="text-sm text-text-secondary">{m.elective_no_results()}</p>
							<button
								type="button"
								onclick={clearFilters}
								class="mt-2 cursor-pointer text-sm font-medium text-text-primary underline"
							>
								{m.common_clear()}
							</button>
						</div>
					{:else}
						<ul class="mt-2 grid gap-2">
							{#each filteredCourses as course (course.id)}
								<CourseRow {course} />
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</main>
	</div>
{/if}
