<script lang="ts">
import { onMount, tick } from 'svelte';
import AssessmentModeBadges from '$lib/components/ui/AssessmentModeBadges.svelte';
import ModuleTypeBadge from '$lib/components/ui/ModuleTypeBadge.svelte';
import type { CatalogCourse } from '$lib/data/catalog-types';
import { courseModuleType } from '$lib/data/course-filters';
import { courseLabel } from '$lib/data/course-label';
import { seasonLabel } from '$lib/data/season';
import * as m from '$lib/paraglide/messages';
import { cloudSyncStore } from '$lib/stores/cloudSyncStore.svelte';
import CourseReviews from './CourseReviews.svelte';

let {
	course,
	courseById,
	onClose,
	onNavigate,
}: {
	course: CatalogCourse | null;
	courseById: ReadonlyMap<string, CatalogCourse>;
	onClose: () => void;
	onNavigate: (course: CatalogCourse) => void;
} = $props();

const TITLE_ID = 'course-browser-detail-title';

let panel: HTMLElement;
let content = $state<HTMLDivElement>();
let closeButton = $state<HTMLButtonElement>();
let isOverlay = $state(false);

const moduleType = $derived(course ? courseModuleType(course) : undefined);
const seasons = $derived(course?.seasons ?? []);
const prerequisiteNote = $derived(course?.prerequisiteNote?.trim() ?? '');
const alternateLabel = $derived.by(() => {
	if (!course) return null;
	const displayed = courseLabel(course);
	if (displayed === course.label) {
		return course.labelEn && course.labelEn !== course.label
			? course.labelEn
			: null;
	}
	return course.label;
});

function focusableElements(): HTMLElement[] {
	return Array.from(
		panel.querySelectorAll<HTMLElement>(
			'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
		),
	).filter(
		(element) =>
			!element.matches(':disabled') && element.getClientRects().length > 0,
	);
}

function handleKeydown(event: KeyboardEvent): void {
	if (!course || !isOverlay || event.key !== 'Tab') return;

	const focusable = focusableElements();
	const first = focusable[0];
	const last = focusable.at(-1);
	if (!first || !last) return;

	if (event.shiftKey && document.activeElement === first) {
		event.preventDefault();
		last.focus();
	} else if (!event.shiftKey && document.activeElement === last) {
		event.preventDefault();
		first.focus();
	}
}

onMount(() => {
	const media = window.matchMedia('(max-width: 1279px)');
	const updateOverlay = () => {
		isOverlay = media.matches;
	};
	const closeOnEscape = (event: KeyboardEvent) => {
		if (event.key === 'Escape' && course) onClose();
	};
	updateOverlay();
	media.addEventListener('change', updateOverlay);
	document.addEventListener('keydown', closeOnEscape);
	return () => {
		media.removeEventListener('change', updateOverlay);
		document.removeEventListener('keydown', closeOnEscape);
	};
});

$effect(() => {
	if (!course || !isOverlay) return;
	void tick().then(() => closeButton?.focus());
});

async function navigateToPrerequisite(
	prerequisite: CatalogCourse,
): Promise<void> {
	onNavigate(prerequisite);
	await tick();
	if (content) content.scrollTop = 0;
	closeButton?.focus({ preventScroll: true });
}
</script>

{#if course}
	<button
		type="button"
		tabindex="-1"
		aria-label={m.browser_details_close()}
		class="fixed inset-0 z-40 cursor-default bg-black/45 xl:hidden"
		onclick={onClose}
	></button>
{/if}

<aside
	bind:this={panel}
	id="course-detail-panel"
	class="inset-y-0 right-0 z-50 w-full flex-col overflow-hidden border-border-primary bg-bg-secondary shadow-2xl sm:max-w-lg xl:static xl:z-auto xl:col-start-3 xl:row-start-1 xl:row-span-2 xl:flex xl:h-full xl:min-h-0 xl:w-auto xl:max-w-none xl:self-stretch xl:rounded-xl xl:border xl:shadow-none"
	class:fixed={course && isOverlay}
	class:hidden={!course}
	class:flex={course}
	role={course ? (isOverlay ? 'dialog' : 'region') : undefined}
	aria-modal={course && isOverlay ? 'true' : undefined}
	aria-labelledby={course ? TITLE_ID : undefined}
	onkeydown={handleKeydown}
>
	{#if course}
		<div bind:this={content} class="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
			<header class="flex items-start justify-between gap-3">
				<div class="min-w-0">
				<p class="font-mono text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
					{course.id}
				</p>
				<h2 id={TITLE_ID} class="mt-1 text-lg font-semibold leading-snug text-text-primary">
					{courseLabel(course)}
				</h2>
				{#if alternateLabel}
					<p class="mt-1 text-xs text-text-secondary">{alternateLabel}</p>
				{/if}
				</div>
				<button
					bind:this={closeButton}
					type="button"
					onclick={onClose}
					aria-label={m.browser_details_close()}
					class="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-primary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
				>
					<span class="i-lucide-x h-4 w-4" aria-hidden="true"></span>
				</button>
			</header>

			<dl class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-text-secondary">
				<div>
					<dt class="sr-only">{m.course_details_ects()}</dt>
					<dd class="font-semibold text-text-primary">{course.ects} ECTS</dd>
				</div>
				<div>
					<dt class="sr-only">{m.course_details_type()}</dt>
					<dd>
						{#if moduleType}
							<ModuleTypeBadge type={moduleType} />
						{:else}
							{m.course_details_unknown()}
						{/if}
					</dd>
				</div>
				<div class="w-full flex flex-wrap gap-x-2 text-xs">
					<dt class="font-semibold text-text-primary">{m.course_details_seasons()}:</dt>
					<dd>
						{seasons.length > 0
							? seasons.map((season) => seasonLabel(season)).join(' · ')
							: m.course_details_unknown()}
					</dd>
				</div>
			</dl>

			{#if course.assessmentModes.length > 0}
				<section class="border-t border-border-primary pt-3" aria-labelledby="course-detail-assessment">
					<h3 id="course-detail-assessment" class="flex items-center gap-2 text-sm font-semibold text-text-primary">
						<span class="i-lucide-clipboard-check h-4 w-4 text-text-secondary" aria-hidden="true"></span>
						{m.assessment_methods()}
					</h3>
					<div class="mt-2">
						<AssessmentModeBadges modes={course.assessmentModes} />
					</div>
				</section>
			{/if}

			<section class="border-t border-border-primary pt-3" aria-labelledby="course-detail-prerequisites">
				<h3 id="course-detail-prerequisites" class="flex items-center gap-2 text-sm font-semibold text-text-primary">
					<span class="i-lucide-git-branch h-4 w-4 text-text-secondary" aria-hidden="true"></span>
					{m.prereq_title()}
				</h3>

				{#if course.assessmentLevelPassed}
					<div class="mt-2 flex items-start gap-2 text-sm text-text-secondary">
						<span class="i-lucide-badge-check mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"></span>
						<span>{m.prereq_assessment_passed()}</span>
					</div>
				{/if}

				{#if course.prerequisites.length > 0}
					<ul class="mt-3 space-y-3">
						{#each course.prerequisites as rule, index}
							{#if index > 0 && course.prerequisites[index - 1]?.prerequisiteLinkType === 'oder'}
								<li class="flex items-center gap-2" aria-hidden="true">
									<span class="h-px flex-1 bg-border-primary"></span>
									<span class="text-xs font-medium text-text-tertiary">{m.prereq_or()}</span>
									<span class="h-px flex-1 bg-border-primary"></span>
								</li>
							{/if}
							<li>
								<p class="text-sm text-text-secondary">
									<span class="font-semibold text-text-primary">
										{rule.mustBePassed
											? m.browser_details_requirement_complete()
											: m.browser_details_requirement_attend()}
									</span>
									{rule.moduleLinkType === 'oder' ? m.prereq_one_of() : m.prereq_all_of()}
								</p>
								<ul class="mt-1.5 space-y-2">
									{#each rule.modules as moduleId}
										{@const prerequisite = courseById.get(moduleId)}
										<li>
											{#if prerequisite}
												{@const prerequisiteType = courseModuleType(prerequisite)}
												<button
													type="button"
													onclick={() => navigateToPrerequisite(prerequisite)}
													aria-label={m.browser_open_course({ course: courseLabel(prerequisite) })}
													class="block w-full cursor-pointer rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-left transition-colors hover:border-blue-500 hover:bg-blue-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
												>
													<span class="flex items-center justify-between gap-2">
														<span class="min-w-0 break-words font-mono text-xs text-text-secondary">{moduleId}</span>
														{#if prerequisiteType}
															<ModuleTypeBadge type={prerequisiteType} />
														{/if}
													</span>
													<span class="block break-words text-sm font-medium text-text-primary">{courseLabel(prerequisite)}</span>
												</button>
											{:else}
												<div class="rounded-lg border border-border-primary px-3 py-2 font-mono text-xs text-text-secondary">{moduleId}</div>
											{/if}
										</li>
									{/each}
								</ul>
							</li>
						{/each}
					</ul>
				{:else if !course.assessmentLevelPassed}
					<p class="mt-2 text-sm text-text-secondary">{m.prereq_none()}</p>
				{/if}
			</section>

			{#if prerequisiteNote}
				<section class="border-t border-border-primary pt-3" aria-labelledby="course-detail-note">
					<h3 id="course-detail-note" class="flex items-center gap-2 text-sm font-semibold text-text-primary">
						<span class="i-lucide-info h-4 w-4 text-text-secondary" aria-hidden="true"></span>
						{m.course_details_note()}
					</h3>
					<p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-secondary">
						{prerequisiteNote}
					</p>
				</section>
			{/if}
			{#key `${course.id}:${cloudSyncStore.user?.id ?? ''}`}
				<CourseReviews courseId={course.id} />
			{/key}
		</div>
	{:else}
		<div class="flex h-full flex-col items-center justify-center px-8 text-center">
			<div class="flex h-12 w-12 items-center justify-center rounded-full border border-border-primary bg-bg-primary text-text-tertiary">
				<span class="i-lucide-panel-right-open h-5 w-5" aria-hidden="true"></span>
			</div>
			<h2 class="mt-4 font-semibold text-text-primary">{m.browser_details_empty_title()}</h2>
			<p class="mt-1 max-w-xs text-sm leading-relaxed text-text-secondary">
				{m.browser_details_empty_text()}
			</p>
		</div>
	{/if}
</aside>
