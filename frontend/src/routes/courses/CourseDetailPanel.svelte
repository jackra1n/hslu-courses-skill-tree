<script lang="ts">
import { onMount, tick } from 'svelte';
import type { AssessmentMode, CatalogCourse } from '$lib/data/catalog-types';
import { courseModuleType } from '$lib/data/course-filters';
import { courseLabel } from '$lib/data/course-label';
import { moduleTypeLabel } from '$lib/data/module-type';
import { seasonLabel } from '$lib/data/season';
import * as m from '$lib/paraglide/messages';

let {
	course,
	courseById,
	onClose,
}: {
	course: CatalogCourse | null;
	courseById: ReadonlyMap<string, CatalogCourse>;
	onClose: () => void;
} = $props();

const TITLE_ID = 'course-browser-detail-title';

let panel: HTMLElement;
let closeButton = $state<HTMLButtonElement>();
let isOverlay = $state(false);

const moduleType = $derived(course ? courseModuleType(course) : undefined);
const seasons = $derived(course?.seasons ?? []);
const prerequisiteNote = $derived(course?.prerequisiteNote?.trim() ?? '');
const assessmentModes = $derived(
	course ? [...new Set(course.assessmentModes)] : [],
);
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

function assessmentModeLabel(mode: AssessmentMode): string {
	switch (mode) {
		case 'coursework':
			return m.browser_assessment_coursework();
		case 'written_exam':
			return m.browser_assessment_written_exam();
		case 'oral_exam':
			return m.browser_assessment_oral_exam();
		case 'electronic_exam':
			return m.browser_assessment_electronic_exam();
	}
}

function focusableElements(): HTMLElement[] {
	return Array.from(
		panel.querySelectorAll<HTMLElement>(
			'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
		),
	).filter((element) => !element.hasAttribute('hidden'));
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
	class="{course ? 'fixed' : 'hidden'} inset-y-0 right-0 z-50 w-full flex-col overflow-hidden border-border-primary bg-bg-secondary shadow-2xl sm:max-w-lg xl:static xl:col-start-3 xl:row-start-1 xl:row-span-2 xl:flex xl:h-full xl:min-h-0 xl:w-auto xl:max-w-none xl:self-stretch xl:rounded-xl xl:border xl:shadow-none"
	class:flex={course}
	role={course ? (isOverlay ? 'dialog' : 'region') : undefined}
	aria-modal={course && isOverlay ? 'true' : undefined}
	aria-labelledby={course ? TITLE_ID : undefined}
	onkeydown={handleKeydown}
>
	{#if course}
		<div class="flex h-14 shrink-0 items-center justify-between border-b border-border-primary px-4 sm:px-5">
			<button
				bind:this={closeButton}
				type="button"
				onclick={onClose}
				aria-label={m.browser_details_close()}
				class="flex h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-primary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 xl:ml-auto xl:w-10 xl:justify-center xl:px-0"
			>
				<span class="i-lucide-arrow-left h-4 w-4 xl:hidden" aria-hidden="true"></span>
				<span class="xl:sr-only">{m.browser_details_back()}</span>
				<span class="i-lucide-x hidden h-4 w-4 xl:block" aria-hidden="true"></span>
			</button>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
			<header>
				<p class="font-mono text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
					{course.id}
				</p>
				<h2 id={TITLE_ID} class="mt-2 text-2xl font-bold leading-tight text-text-primary">
					{courseLabel(course)}
				</h2>
				{#if alternateLabel}
					<p class="mt-1 text-sm text-text-secondary">{alternateLabel}</p>
				{/if}
			</header>

			<section class="mt-6" aria-labelledby="course-detail-summary">
				<h3 id="course-detail-summary" class="text-sm font-semibold text-text-primary">
					{m.browser_details_summary()}
				</h3>
				<dl class="mt-2 grid grid-cols-2 gap-2">
					<div class="rounded-lg border border-border-primary bg-bg-primary p-3">
						<dt class="flex items-center gap-1.5 text-xs text-text-tertiary">
							<span class="i-lucide-graduation-cap h-3.5 w-3.5" aria-hidden="true"></span>
							{m.browser_details_ects()}
						</dt>
						<dd class="mt-1 font-semibold text-text-primary">{course.ects} ECTS</dd>
					</div>
					<div class="rounded-lg border border-border-primary bg-bg-primary p-3">
						<dt class="flex items-center gap-1.5 text-xs text-text-tertiary">
							<span class="i-lucide-layers h-3.5 w-3.5" aria-hidden="true"></span>
							{m.browser_details_type()}
						</dt>
						<dd class="mt-1 font-semibold text-text-primary">
							{moduleTypeLabel(moduleType)}
						</dd>
					</div>
					<div class="col-span-2 rounded-lg border border-border-primary bg-bg-primary p-3">
						<dt class="flex items-center gap-1.5 text-xs text-text-tertiary">
							<span class="i-lucide-calendar-days h-3.5 w-3.5" aria-hidden="true"></span>
							{m.browser_details_seasons()}
						</dt>
						<dd class="mt-1 font-semibold text-text-primary">
							{seasons.length > 0
								? seasons.map((season) => seasonLabel(season)).join(' · ')
								: m.browser_details_unknown()}
						</dd>
					</div>
				</dl>
			</section>

			{#if assessmentModes.length > 0}
				<section class="mt-6 border-t border-border-primary pt-5" aria-labelledby="course-detail-assessment">
					<h3 id="course-detail-assessment" class="flex items-center gap-2 text-sm font-semibold text-text-primary">
						<span class="i-lucide-clipboard-check h-4 w-4 text-text-secondary" aria-hidden="true"></span>
						{m.browser_details_assessment()}
					</h3>
					<ul class="mt-3 flex flex-wrap gap-2">
						{#each assessmentModes as mode}
							<li class="rounded-full border border-border-primary bg-bg-primary px-3 py-1.5 text-sm text-text-secondary">
								{assessmentModeLabel(mode)}
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section class="mt-6 border-t border-border-primary pt-5" aria-labelledby="course-detail-prerequisites">
				<h3 id="course-detail-prerequisites" class="flex items-center gap-2 text-sm font-semibold text-text-primary">
					<span class="i-lucide-git-branch h-4 w-4 text-text-secondary" aria-hidden="true"></span>
					{m.prereq_title()}
				</h3>

				{#if course.assessmentLevelPassed}
					<div class="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
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
							<li class="rounded-lg border border-border-primary bg-bg-primary p-3">
								<p class="text-sm text-text-secondary">
									<span class="font-semibold text-text-primary">
										{rule.mustBePassed
											? m.browser_details_requirement_complete()
											: m.browser_details_requirement_attend()}
									</span>
									{rule.moduleLinkType === 'oder' ? m.prereq_one_of() : m.prereq_all_of()}
								</p>
								<ul class="mt-2 space-y-1.5">
									{#each rule.modules as moduleId}
										{@const prerequisite = courseById.get(moduleId)}
										<li class="flex items-start gap-2 text-sm">
											<span class="i-lucide-book-open mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true"></span>
											<span class="min-w-0">
												<span class="font-mono text-xs font-semibold text-text-secondary">{moduleId}</span>
												{#if prerequisite}
													<span class="block break-words text-text-primary">{courseLabel(prerequisite)}</span>
												{/if}
											</span>
										</li>
									{/each}
								</ul>
							</li>
						{/each}
					</ul>
				{:else if !course.assessmentLevelPassed}
					<p class="mt-3 text-sm text-text-secondary">{m.prereq_none()}</p>
				{/if}
			</section>

			{#if prerequisiteNote}
				<section class="mt-6 border-t border-border-primary pt-5" aria-labelledby="course-detail-note">
					<h3 id="course-detail-note" class="flex items-center gap-2 text-sm font-semibold text-text-primary">
						<span class="i-lucide-info h-4 w-4 text-text-secondary" aria-hidden="true"></span>
						{m.browser_details_note()}
					</h3>
					<p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-secondary">
						{prerequisiteNote}
					</p>
				</section>
			{/if}
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
