<script lang="ts">
import type { Snippet } from 'svelte';
import ModuleTypeBadge from '$lib/components/ui/ModuleTypeBadge.svelte';
import { assessmentModeLabel } from '$lib/data/assessment-mode';
import type { Course, ModuleType } from '$lib/data/catalog-types';
import { courseLabel } from '$lib/data/course-label';
import { seasonLabel } from '$lib/data/season';
import * as m from '$lib/paraglide/messages';
import { cloudSyncStore } from '$lib/stores/cloudSyncStore.svelte';
import { locale } from '$lib/stores/locale.svelte';
import CourseReviews from './CourseReviews.svelte';
import PrerequisiteSummary from './PrerequisiteSummary.svelte';

let {
	course,
	moduleType,
	titleId,
	semester,
	targetNodeId,
	close,
	prerequisites,
	actions,
	selector,
	elective = false,
}: {
	course: Omit<Course, 'type'>;
	moduleType?: ModuleType;
	titleId: string;
	semester?: number;
	targetNodeId?: string;
	close: Snippet;
	prerequisites: Snippet;
	actions?: Snippet;
	selector?: Snippet;
	elective?: boolean;
} = $props();

const id = $props.id();
const tabs = ['overview', 'prerequisites', 'reviews'] as const;
type Tab = (typeof tabs)[number];
let activeTab = $state<Tab>('overview');
let reviewsVisited = $state(false);
const labels = $derived({
	overview: m.course_details_overview(),
	prerequisites: m.prereq_title(),
	reviews: m.course_details_reviews(),
});
const alternateLabel = $derived(
	courseLabel(course) === course.label
		? course.labelEn !== course.label
			? course.labelEn
			: null
		: course.label,
);
const languageNames = $derived(
	new Intl.DisplayNames([locale()], { type: 'language' }),
);
const hasPrerequisites = $derived(
	course.assessmentLevelPassed ||
		course.prerequisites.length > 0 ||
		!!course.prerequisiteNote?.trim(),
);

function selectTab(tab: Tab) {
	activeTab = tab;
	if (tab === 'reviews') reviewsVisited = true;
}

function handleTabKey(event: KeyboardEvent, index: number) {
	let next: number;
	if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
	else if (event.key === 'ArrowLeft')
		next = (index + tabs.length - 1) % tabs.length;
	else if (event.key === 'Home') next = 0;
	else if (event.key === 'End') next = tabs.length - 1;
	else return;
	event.preventDefault();
	selectTab(tabs[next]);
	document.getElementById(`${id}-tab-${tabs[next]}`)?.focus();
}
</script>

<header class="px-5 pt-5 pb-4">
	<div class="flex items-start justify-between gap-2">
		<div class="min-w-0">
			<p class="font-mono text-xs font-semibold tracking-wide text-blue-600 dark:text-blue-400">{course.id}</p>
			<h2 id={titleId} class="mt-2 text-xl font-semibold leading-snug text-text-primary break-words">{courseLabel(course)}</h2>
			{#if alternateLabel}<p class="mt-1 text-sm leading-relaxed text-text-secondary">{alternateLabel}</p>{/if}
		</div>
		{@render close()}
	</div>
	<dl class="mt-4 flex flex-wrap items-center gap-2">
		<div><dt class="sr-only">{m.course_details_ects()}</dt><dd class="inline-flex items-center rounded-md border border-border-primary px-2.5 py-1 text-sm font-medium text-text-primary">{course.ects} ECTS</dd></div>
		{#if moduleType}<div><dt class="sr-only">{m.course_details_type()}</dt><dd><ModuleTypeBadge type={moduleType} size="md" /></dd></div>{/if}
	</dl>
	<dl class="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm leading-relaxed">
		<dt class="flex items-center gap-2 text-text-primary"><span class="i-lucide-calendar-days h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true"></span>{m.course_details_seasons()}</dt>
		<dd class="text-text-secondary">{course.seasons?.length ? course.seasons.map(seasonLabel).join(' · ') : m.course_details_unknown()}</dd>
		{#if semester !== undefined}
			<dt class="flex items-center gap-2 text-text-primary"><span class="i-lucide-layers h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true"></span>{m.course_details_plan_semester()}</dt>
			<dd class="text-text-secondary">{semester}</dd>
		{/if}
		{#if !elective}
			<dt class="flex items-center gap-2 text-text-primary"><span class="i-lucide-languages h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true"></span>{m.course_details_languages()}</dt>
			<dd class="text-text-secondary">{course.languages?.length ? course.languages.map((language) => languageNames.of(language)).join(', ') : m.course_details_unknown()}</dd>
		{/if}
	</dl>
</header>
{#if selector}<div class="px-5 pb-4">{@render selector()}</div>{/if}

{#if !elective}
<div role="tablist" aria-label={m.course_details_tabs()} class="sticky top-0 z-10 mx-4 flex border-b border-border-primary bg-bg-secondary">
	{#each tabs as tab, index}
		<button type="button" role="tab" id={`${id}-tab-${tab}`} aria-selected={activeTab === tab} aria-controls={`${id}-panel-${tab}`} tabindex={activeTab === tab ? 0 : -1} onclick={() => selectTab(tab)} onkeydown={(event) => handleTabKey(event, index)} class={`min-h-11 min-w-0 flex-auto cursor-pointer border-b-2 px-2 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${activeTab === tab ? 'border-blue-500 text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
			{labels[tab]}
		</button>
	{/each}
</div>

<div id={`${id}-panel-overview`} role="tabpanel" aria-labelledby={`${id}-tab-overview`} hidden={activeTab !== 'overview'} tabindex="0" class="p-5 space-y-5 focus-visible:outline-blue-500">
	<section aria-labelledby={`${id}-assessment`}>
		<h3 id={`${id}-assessment`} class="text-sm font-semibold text-text-primary">{m.assessment_methods()}</h3>
		{#if course.assessmentModes.length}
			<ul class="mt-3 space-y-3">
				{#each course.assessmentModes as mode}
					<li class="flex items-start gap-3 text-sm leading-relaxed text-text-secondary"><span class="i-lucide-clipboard-check mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"></span>{assessmentModeLabel(mode)}</li>
				{/each}
			</ul>
		{:else}<p class="mt-2 text-sm text-text-secondary">{m.course_details_unknown()}</p>{/if}
	</section>
	<section class="border-t border-border-primary pt-4" aria-labelledby={`${id}-summary`}>
		<h3 id={`${id}-summary`} class="text-sm font-semibold text-text-primary">{m.course_details_prerequisite_summary()}</h3>
		{#if hasPrerequisites}
			<PrerequisiteSummary {course} {targetNodeId} />
			<button type="button" class="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline focus-visible:outline-blue-500" onclick={() => { selectTab('prerequisites'); document.getElementById(`${id}-tab-prerequisites`)?.focus(); }}>{m.course_details_view_prerequisites()}<span class="i-lucide-arrow-right h-4 w-4" aria-hidden="true"></span></button>
		{:else}<p class="mt-2 text-sm leading-relaxed text-text-secondary">{m.prereq_none()}</p>{/if}
	</section>
</div>
<div id={`${id}-panel-prerequisites`} role="tabpanel" aria-labelledby={`${id}-tab-prerequisites`} hidden={activeTab !== 'prerequisites'} tabindex="0" class="p-5 space-y-4 focus-visible:outline-blue-500">
	{@render prerequisites()}
</div>
<div id={`${id}-panel-reviews`} role="tabpanel" aria-labelledby={`${id}-tab-reviews`} hidden={activeTab !== 'reviews'} tabindex="0" class="p-5 focus-visible:outline-blue-500">
	{#if reviewsVisited}
		{#key `${course.id}:${cloudSyncStore.user?.id ?? ''}`}<CourseReviews courseId={course.id} />{/key}
	{/if}
</div>
{/if}
{#if actions}<div class="px-5 pb-5">{@render actions()}</div>{/if}
