<script lang="ts">
import { onMount, tick } from 'svelte';
import AccountMenu from '$lib/components/header/AccountMenu.svelte';
import SettingsSidebar from '$lib/components/sidebar/SettingsSidebar.svelte';
import Dropdown from '$lib/components/ui/Dropdown.svelte';
import Tooltip from '$lib/components/ui/Tooltip.svelte';
import { loadCatalog } from '$lib/data/catalog-loader';
import type {
	AssessmentMode,
	CatalogCourse,
	ModuleType,
} from '$lib/data/catalog-types';
import {
	courseModuleType,
	type EctsRange,
	EMPTY_FILTERS,
	filterCourses,
	isFiltering,
} from '$lib/data/course-filters';
import { courseLabel } from '$lib/data/course-label';
import { nextCourseIds } from '$lib/data/course-readiness';
import {
	collectAppData,
	hasMeaningfulStoredAppData,
} from '$lib/data/persistence';
import { fetchCourseReviewScores } from '$lib/data/review-client';
import { type Season } from '$lib/data/season';
import * as m from '$lib/paraglide/messages';
import { cloudSyncStore } from '$lib/stores/cloudSyncStore.svelte';
import { initializeCourseStore } from '$lib/stores/courseStore.svelte';
import { progressStore, slotStatusMap } from '$lib/stores/progressStore.svelte';
import { uiStore } from '$lib/stores/uiStore.svelte';
import { measureHeaderHeight } from '$lib/utils/header-height';
import { getAssessmentStageProgress } from '$lib/utils/status';
import CourseDetailPanel from './CourseDetailPanel.svelte';
import CourseRow from './CourseRow.svelte';
import FilterSidebar from './FilterSidebar.svelte';

type Phase = 'loading' | 'ready' | 'error';

let phase = $state<Phase>('loading');
let courses = $state<CatalogCourse[]>([]);
let settingsOpen = $state(false);
let selectedCourse = $state<CatalogCourse | null>(null);
let selectedTrigger: HTMLButtonElement | null = null;
let courseStore = $state.raw<ReturnType<typeof initializeCourseStore> | null>(
	null,
);

let query = $state(EMPTY_FILTERS.query);
let season = $state<Season | 'all'>(EMPTY_FILTERS.season);
let moduleTypes = $state<ModuleType[]>([]);
let assessmentModes = $state<AssessmentMode[]>([]);
let ects = $state<EctsRange>(EMPTY_FILTERS.ects);
let nextOnly = $state(false);
let sidebarOpen = $state(false);
type CourseSort = 'name-asc' | 'name-desc' | 'rating-desc' | 'rating-asc';
let sort = $state<CourseSort>('name-asc');
let reviewScores = $state<Record<string, number | null>>({});
let scoresLoaded = $state(false);
let scoresLoading = $state(false);
const scoresController = new AbortController();
const sortOptions = $derived<
	{ value: CourseSort; label: string; disabled?: boolean }[]
>([
	{ value: 'name-asc', label: m.browser_sort_name_asc() },
	{ value: 'name-desc', label: m.browser_sort_name_desc() },
	{
		value: 'rating-desc',
		label: m.browser_sort_rating_desc(),
		disabled: !scoresLoaded,
	},
	{
		value: 'rating-asc',
		label: m.browser_sort_rating_asc(),
		disabled: !scoresLoaded,
	},
]);
const filters = $derived({ query, season, moduleTypes, assessmentModes, ects });
const courseById = $derived(
	new Map(courses.map((course) => [course.id, course])),
);
const sortedCourses = $derived(
	courses.toSorted((a, b) => {
		if (sort === 'rating-desc' || sort === 'rating-asc') {
			const aScore = reviewScores[a.id] ?? null;
			const bScore = reviewScores[b.id] ?? null;
			if (aScore !== bScore) {
				if (aScore === null) return 1;
				if (bScore === null) return -1;
				return sort === 'rating-desc' ? bScore - aScore : aScore - bScore;
			}
		}
		const byName = courseLabel(a).localeCompare(courseLabel(b));
		return sort === 'name-desc' ? -byName : byName;
	}),
);
const catalogFilteredCourses = $derived(filterCourses(sortedCourses, filters));
const nextCourseIdSet = $derived.by(() => {
	if (!courseStore) return new Set<string>();
	const plan = courseStore.studyPlan;
	const statuses = slotStatusMap();
	const assessmentStageMet = getAssessmentStageProgress(plan, statuses).passed;
	return nextCourseIds(courses, plan, statuses, assessmentStageMet);
});
const filteredCourses = $derived(
	nextOnly
		? catalogFilteredCourses.filter((course) => nextCourseIdSet.has(course.id))
		: catalogFilteredCourses,
);
// facet counts apply every other filter, but not their own selection.
const countableCourses = $derived(
	nextOnly
		? courses.filter((course) => nextCourseIdSet.has(course.id))
		: courses,
);
const moduleTypeCounts = $derived.by(() => {
	const counts: Partial<Record<ModuleType, number>> = {};
	for (const course of filterCourses(countableCourses, {
		...filters,
		moduleTypes: [],
	})) {
		const type = courseModuleType(course);
		if (type) counts[type] = (counts[type] ?? 0) + 1;
	}
	return counts;
});
const assessmentModeCounts = $derived.by(() => {
	const counts: Partial<Record<AssessmentMode, number>> = {};
	for (const course of filterCourses(countableCourses, {
		...filters,
		assessmentModes: [],
	})) {
		for (const mode of course.assessmentModes)
			counts[mode] = (counts[mode] ?? 0) + 1;
	}
	return counts;
});
const filtering = $derived(isFiltering(filters) || nextOnly);
const activeFilterCount = $derived(
	(query.trim() !== '' ? 1 : 0) +
		(season !== 'all' ? 1 : 0) +
		(moduleTypes.length > 0 ? 1 : 0) +
		(assessmentModes.length > 0 ? 1 : 0) +
		(ects !== null ? 1 : 0) +
		(nextOnly ? 1 : 0),
);
// slider stops are the distinct ECTS values in the catalog, so every stop
// matches real courses.
const ectsSteps = $derived(
	[...new Set(courses.map((course) => course.ects))].sort((a, b) => a - b),
);

function clearFilters(): void {
	query = EMPTY_FILTERS.query;
	season = EMPTY_FILTERS.season;
	moduleTypes = [];
	assessmentModes = [];
	ects = EMPTY_FILTERS.ects;
	nextOnly = false;
}
function selectCourse(course: CatalogCourse, trigger: HTMLButtonElement): void {
	selectedCourse = course;
	selectedTrigger = trigger;
}

async function closeCourseDetails(): Promise<void> {
	selectedCourse = null;
	await tick();
	if (selectedTrigger?.isConnected) selectedTrigger.focus();
	selectedTrigger = null;
}

async function loadReviewScores(): Promise<void> {
	if (scoresLoading) return;
	scoresLoading = true;
	try {
		const scores = await fetchCourseReviewScores(scoresController.signal);
		if (scoresController.signal.aborted) return;
		// a detail-panel read may have returned a fresher summary while this
		// initial aggregate request was in flight, including a deleted review.
		reviewScores = {
			...Object.fromEntries(
				scores.map((score) => [score.courseId, score.recommendation]),
			),
			...reviewScores,
		};
		scoresLoaded = true;
	} catch {
		// scores are optional; leave score sorting disabled without a notice.
	} finally {
		if (!scoresController.signal.aborted) scoresLoading = false;
	}
}

async function load(): Promise<void> {
	phase = 'loading';
	try {
		const catalog = await loadCatalog();
		courses = catalog.courses;
		const requestedCourse = new URL(window.location.href).searchParams.get(
			'course',
		);
		selectedCourse =
			courses.find((course) => course.id === requestedCourse) ?? null;
		// the settings sidebar and account menu need the same stores as the
		// skill Tree page, without its study-plan specific header controls.
		const localDataIsMeaningful = hasMeaningfulStoredAppData();
		courseStore = initializeCourseStore();
		courseStore.init();
		progressStore.init();
		uiStore.init();
		await cloudSyncStore.init(localDataIsMeaningful);
		phase = 'ready';
	} catch (error) {
		console.error('Failed to load course catalog', error);
		phase = 'error';
	}
}

// keep cloud sync in sync when settings actions mutate study plan or
// progress, mirroring the Skill Tree page snapshot effect.
$effect(() => {
	if (phase !== 'ready') return;
	cloudSyncStore.recordLocalSnapshot(collectAppData());
});

onMount(() => {
	void load();
	void loadReviewScores();
	return () => scoresController.abort();
});
</script>

<svelte:head>
	<title>{m.browser_title()}</title>
	<meta name="description" content={m.browser_meta_description()} />
</svelte:head>

{#if phase === 'loading'}
	<div class="flex min-h-screen items-center justify-center font-sans">
		<p class="text-text-secondary" role="status">{m.browser_loading()}</p>
	</div>
{:else if phase === 'error'}
	<div class="flex min-h-screen items-center justify-center font-sans">
		<p class="text-text-primary" role="alert">
			{m.browser_load_error()}
			<button type="button" class="underline" onclick={load}>
				{m.common_retry()}
			</button>
		</p>
	</div>
{:else}
	<div class="flex h-screen h-dvh overflow-hidden flex-col bg-bg-primary font-sans text-text-primary">
		<header {@attach measureHeaderHeight} class="shrink-0 border-b border-border-primary bg-bg-primary px-4 py-2 sm:py-3">
			<div class="mx-auto flex w-full max-w-[90rem] items-center justify-between gap-3">
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
							onclick={() => (settingsOpen = !settingsOpen)}
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
			showTutorial={false}
		/>
		<main class="mx-auto flex min-h-0 w-full max-w-[90rem] flex-1 flex-col px-4 py-6">
			<div class="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:items-start lg:gap-8 xl:grid-cols-[16rem_minmax(0,1fr)_30rem]">
				<div class="lg:col-start-2">
					<h1 class="text-2xl font-bold">{m.browser_title()}</h1>
					<p class="mt-1 text-sm text-text-secondary">
						{m.browser_description()}
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
					<div class="mt-3 flex items-center gap-3">
						<label for="course-sort" class="shrink-0 text-sm font-medium text-text-secondary">{m.browser_sort()}</label>
						<div class="min-w-0 flex-1">
							<Dropdown id="course-sort" label={m.browser_sort()} options={sortOptions} selected={sort} onSelect={(value) => { sort = value; }} />
						</div>
					</div>
					{#if scoresLoading}
						<p role="status" class="mt-2 text-xs text-text-secondary">{m.browser_scores_loading()}</p>
					{/if}
				</div>
				<div class="{sidebarOpen ? 'block' : 'hidden'} mt-3 max-h-[45dvh] shrink-0 overflow-y-auto lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:mt-0 lg:block lg:min-h-0 lg:max-h-none lg:h-full">
					<div>
						<FilterSidebar
							bind:season
							bind:moduleTypes
							bind:assessmentModes
							bind:ects
							bind:nextOnly
							{ectsSteps}
							{moduleTypeCounts}
							{assessmentModeCounts}
							{filtering}
							onReset={clearFilters}
						/>
					</div>
				</div>
				<div class="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden lg:col-start-2 lg:row-start-2 lg:mt-3 lg:self-stretch">
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
					<div class="mt-2 min-h-0 flex-1 overflow-y-auto">
						{#if filteredCourses.length === 0}
							<div
								class="rounded-lg border border-border-primary bg-bg-secondary p-6 text-center"
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
							<ul class="grid grid-cols-1 gap-2">
								{#each filteredCourses as course (course.id)}
									<CourseRow
										{course}
										selected={selectedCourse?.id === course.id}
										onSelect={selectCourse}
									/>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
				<CourseDetailPanel
					course={selectedCourse}
					{courseById}
					onClose={closeCourseDetails}
					onNavigate={(course) => (selectedCourse = course)}
					onReviewSummary={(courseId, summary) => { reviewScores[courseId] = summary.recommendation; }}
				/>
			</div>
		</main>
	</div>
{/if}
