<script lang="ts">
import { onMount, tick } from 'svelte';
import AssessmentModeBadges from '$lib/components/ui/AssessmentModeBadges.svelte';
import ModuleTypeBadge from '$lib/components/ui/ModuleTypeBadge.svelte';
import PrerequisiteWarning from '$lib/components/ui/PrerequisiteWarning.svelte';
import { courseLabel } from '$lib/data/course-label';
import { getCourseById } from '$lib/data/courses';
import { type Season, seasonLabel } from '$lib/data/season';
import * as m from '$lib/paraglide/messages';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import {
	hasSelection,
	isElectiveSlot,
	selection,
	uiStore,
} from '$lib/stores/uiStore.svelte';
import { hasPlanPrereqConflict } from '$lib/utils/prerequisite';
import {
	hasAssessmentStageViolation,
	hasMissingPrerequisites,
} from '$lib/utils/status';
import ActionButtons from './ActionButtons.svelte';
import ElectiveCourseSelector from './ElectiveCourseSelector.svelte';
import PrerequisiteList from './PrerequisiteList.svelte';
import StatusLegend from './StatusLegend.svelte';

const TITLE_ID = 'skill-tree-course-detail-title';

let panel: HTMLElement;
let closeButton = $state<HTMLButtonElement>();
let isOverlay = $state(false);

const courseStore = getCourseStore();

const displayCourse = $derived.by(() => {
	const sel = selection();
	if (!sel) return null;

	if (isElectiveSlot()) {
		const selectedCourseId = courseStore.userSelections[sel.id];
		if (selectedCourseId) {
			const selectedCourse = getCourseById(selectedCourseId);
			if (selectedCourse) {
				return selectedCourse;
			}
			return sel;
		}
	}

	return sel;
});

const activePlanNode = $derived.by(() => {
	const sel = selection();
	if (!sel) return null;
	const plan = courseStore.studyPlan;
	const slotMatch = plan.nodes[sel.id];
	if (slotMatch) return slotMatch;
	return (
		Object.values(plan.nodes).find((node) => node.courseId === sel.id) ?? null
	);
});

const warningType = $derived.by(() => {
	if (!displayCourse || !activePlanNode) return null;

	const plan = courseStore.studyPlan;

	if (
		hasPlanPrereqConflict(plan, activePlanNode.id, {
			considerSameSemester: false,
		})
	) {
		return 'later-prerequisites';
	}

	if (hasMissingPrerequisites(plan, activePlanNode.id)) {
		return 'missing-prerequisites';
	}

	if (hasAssessmentStageViolation(plan, activePlanNode.id)) {
		return 'assessment-stage';
	}

	return null;
});

const prerequisiteNote = $derived.by(
	() => displayCourse?.prerequisiteNote?.trim() ?? '',
);
const isDrawerOpen = $derived(hasSelection());
const alternateLabel = $derived.by(() => {
	if (!displayCourse) return null;
	const displayed = courseLabel(displayCourse);
	if (displayed === displayCourse.label) {
		return displayCourse.labelEn &&
			displayCourse.labelEn !== displayCourse.label
			? displayCourse.labelEn
			: null;
	}
	return displayCourse.label;
});
const offeredSeasons = $derived.by(() => {
	const seasons = displayCourse?.seasons;
	if (!seasons || seasons.length === 0) return null;
	return (['HS', 'FS'] as Season[])
		.filter((season) => seasons.includes(season))
		.map((season) => seasonLabel(season))
		.join(' · ');
});

function focusableElements(): HTMLElement[] {
	return Array.from(
		panel.querySelectorAll<HTMLElement>(
			'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
		),
	).filter((element) => !element.hasAttribute('hidden'));
}

function closeDetails(): void {
	uiStore.deselectCourse();
}

function handleKeydown(event: KeyboardEvent): void {
	if (!isDrawerOpen || !isOverlay) return;
	if (event.key === 'Escape') {
		event.preventDefault();
		closeDetails();
		return;
	}
	if (event.key !== 'Tab') return;

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
	updateOverlay();
	media.addEventListener('change', updateOverlay);
	return () => media.removeEventListener('change', updateOverlay);
});

$effect(() => {
	if (!displayCourse?.id) return;
	void tick().then(() => {
		panel.scrollTop = 0;
	});
});

$effect(() => {
	if (!isDrawerOpen || !isOverlay) return;
	const focusOrigin =
		document.activeElement instanceof HTMLElement &&
		document.activeElement !== document.body
			? document.activeElement
			: null;
	void tick().then(() => closeButton?.focus());
	return () => {
		if (focusOrigin?.isConnected) focusOrigin.focus();
	};
});
</script>

{#if isDrawerOpen}
  <button
    type="button"
    tabindex="-1"
    aria-label={m.details_deselect()}
    class="fixed inset-0 z-[70] cursor-default bg-black/45 xl:hidden"
    onclick={closeDetails}
  ></button>
{/if}

<aside
  bind:this={panel}
  id="skill-tree-course-detail-panel"
  class={`fixed inset-y-0 right-0 z-[80] w-full overflow-y-auto border border-border-primary bg-bg-secondary shadow-2xl transition-transform duration-300 ease-out sm:max-w-lg
    ${isDrawerOpen ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'}
    xl:static xl:z-auto xl:max-w-none xl:w-full xl:border-y-0 xl:border-r-0 xl:border-l xl:translate-x-0 xl:shadow-none xl:pointer-events-auto`}
  role={isDrawerOpen ? (isOverlay ? 'dialog' : 'region') : undefined}
  aria-modal={isDrawerOpen && isOverlay ? 'true' : undefined}
  aria-labelledby={isDrawerOpen ? TITLE_ID : undefined}
  onkeydown={handleKeydown}
>
  {#if hasSelection()}
    <div class="p-4 space-y-4">
      <header>
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            {#if displayCourse}
              <p class="font-mono text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                {displayCourse.id}
              </p>
              <h2 id={TITLE_ID} class="mt-1 text-lg font-semibold leading-snug text-text-primary">
                {courseLabel(displayCourse)}
              </h2>
              {#if alternateLabel}
                <p class="mt-1 text-xs text-text-secondary">{alternateLabel}</p>
              {/if}
            {/if}
          </div>
          <button
            bind:this={closeButton}
            type="button"
            onclick={closeDetails}
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-primary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title={m.details_deselect()}
            aria-label={m.details_deselect()}
          >
            <span class="i-lucide-x h-4 w-4" aria-hidden="true"></span>
          </button>
        </div>
      </header>

      {#if displayCourse}
        <dl class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-text-secondary">
          <div>
            <dt class="sr-only">{m.course_details_ects()}</dt>
            <dd class="font-semibold text-text-primary">{displayCourse.ects} ECTS</dd>
          </div>
          <div>
            <dt class="sr-only">{m.course_details_type()}</dt>
            <dd>
              {#if displayCourse.type}
                <ModuleTypeBadge type={displayCourse.type} />
              {:else}
                {m.course_details_unknown()}
              {/if}
            </dd>
          </div>
          <div>
            <dt class="sr-only">{m.course_details_plan_semester()}</dt>
            <dd>{m.details_semester({ number: activePlanNode?.semester ?? '?' })}</dd>
          </div>
          <div class="w-full flex flex-wrap gap-x-2 text-xs">
            <dt>{m.course_details_seasons()}</dt>
            <dd>{offeredSeasons ?? m.course_details_unknown()}</dd>
          </div>
        </dl>
      {/if}

      {#if isElectiveSlot()}
        <ElectiveCourseSelector slotId={selection()?.id || ''} />
      {:else}
        {#if displayCourse && displayCourse.assessmentModes.length > 0}
          <section class="border-t border-border-primary pt-3" aria-labelledby="skill-tree-detail-assessment">
            <h3 id="skill-tree-detail-assessment" class="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <span class="i-lucide-clipboard-check h-4 w-4 text-text-secondary" aria-hidden="true"></span>
              {m.assessment_methods()}
            </h3>
            <div class="mt-2">
              <AssessmentModeBadges modes={displayCourse.assessmentModes} />
            </div>
          </section>
        {/if}
        {#if warningType}
          <PrerequisiteWarning type={warningType} />
        {/if}
        <PrerequisiteList prerequisites={displayCourse?.prerequisites || []} assessmentLevelPassed={displayCourse?.assessmentLevelPassed} />
      {/if}

      {#if prerequisiteNote}
        <section class="border-t border-border-primary pt-3" aria-labelledby="skill-tree-detail-note">
          <h3 id="skill-tree-detail-note" class="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <span class="i-lucide-info h-4 w-4 text-text-secondary" aria-hidden="true"></span>
            {m.course_details_note()}
          </h3>
          <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-secondary">
            {prerequisiteNote}
          </p>
        </section>
      {/if}

      {#if !isElectiveSlot()}
        <ActionButtons courseId={displayCourse?.id || ''} />
      {/if}
    </div>
  {:else}
    <div class="p-6 space-y-6">
      <div class="text-center py-8">
        <div class="i-lucide-mouse-pointer-click w-12 h-12 mx-auto text-text-secondary mb-3"></div>
        <p class="text-sm text-text-secondary">
          {m.details_empty_hint()}
        </p>
        <p class="text-xs text-text-tertiary mt-2">
          {m.details_empty_elective_hint()}
        </p>
      </div>
      
      <div class="hidden xl:block">
        <StatusLegend />
      </div>
    </div>
  {/if}
</aside>
