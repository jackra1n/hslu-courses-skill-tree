<script lang="ts">
import ActionButtons from '$lib/components/sidebar/ActionButtons.svelte';
import PrerequisiteList from '$lib/components/sidebar/PrerequisiteList.svelte';
import Combobox from '$lib/components/ui/Combobox.svelte';
import PrerequisiteWarning from '$lib/components/ui/PrerequisiteWarning.svelte';
import { COURSES, type Course, getCourseById } from '$lib/data/courses';
import { courseLabel } from '$lib/data/course-label';
import { seasonLabel, type Season } from '$lib/data/season';
import * as messages from '$lib/paraglide/messages';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import { hasPlanPrereqConflict } from '$lib/utils/prerequisite';
import {
	hasAssessmentStageViolation,
	hasMissingPrerequisites,
} from '$lib/utils/status';

let { slotId }: { slotId: string } = $props();

const courseStore = getCourseStore();

const selectedCourseId = $derived(courseStore.userSelections[slotId]);
const selectedCourse = $derived.by(() => {
	if (!selectedCourseId) return null;
	return getCourseById(selectedCourseId) ?? null;
});

const slotNode = $derived(courseStore.studyPlan.nodes[slotId]);

const warningType = $derived.by(() => {
	if (!selectedCourse) return null;

	const plan = courseStore.studyPlan;

	if (hasPlanPrereqConflict(plan, slotId, { considerSameSemester: false })) {
		return 'later-prerequisites';
	}

	if (hasMissingPrerequisites(plan, slotId)) {
		return 'missing-prerequisites';
	}

	if (hasAssessmentStageViolation(plan, slotId)) {
		return 'assessment-stage';
	}

	return null;
});

const availableCourses = $derived(
	COURSES.filter((course) => {
		if (!slotNode) return false;
		if (selectedCourseId === course.id) return true;
		return courseStore.canSelectCourseForSlot(slotId, course.id);
	}),
);

const slotSeason = $derived(
	slotNode ? courseStore.seasonOf(slotNode.semester) : null,
);

function isOfferedIn(course: Course, season: Season): boolean {
	return (
		!course.seasons ||
		course.seasons.length === 0 ||
		course.seasons.includes(season)
	);
}

const comboboxOptions = $derived.by(() => {
	const options = availableCourses.map((course) => {
		const outOfSeason = slotSeason !== null && !isOfferedIn(course, slotSeason);
		return {
			value: course.id,
			label: messages.elective_option_label({
				name: courseLabel(course),
				id: course.id,
				ects: course.ects,
			}),
			// search matches either language, regardless of the active locale
			keywords: [course.label, course.labelEn ?? '', course.id],
			// keep an already-chosen course usable even if the start season later changed
			disabled: outOfSeason && course.id !== selectedCourseId,
			tooltip: outOfSeason
				? messages.elective_only_offered({ seasons: formatSeasons(course.seasons) })
				: undefined,
		};
	});
	// out-of-season (disabled) courses sink to the bottom; order is otherwise stable
	return options.sort((a, b) => Number(a.disabled) - Number(b.disabled));
});

function formatSeasons(seasons: Season[] | undefined): string {
	if (!seasons || seasons.length === 0) return messages.elective_other_semesters();
	return (['HS', 'FS'] as Season[])
		.filter((s) => seasons.includes(s))
		.map((s) => seasonLabel(s))
		.join(' & ');
}

function handleCourseSelect(courseId: string) {
	if (courseId) {
		courseStore.selectCourseForSlot(slotId, courseId);
	} else {
		courseStore.clearSlotSelection(slotId);
	}
}

function clearSelection() {
	courseStore.clearSlotSelection(slotId);
}
</script>

<div class="border-t border-border-primary pt-4">
  <h3 class="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
    <div class="i-lucide-book-plus text-text-secondary"></div>
    {messages.elective_select_title()}
  </h3>
  <div class="space-y-3">
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label for="elective-course-select" class="text-sm font-medium text-text-primary">
          {messages.elective_choose()}
        </label>
        {#if selectedCourseId}
          <button 
            onclick={clearSelection}
            class="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            {messages.common_clear()}
          </button>
        {/if}
      </div>
      <Combobox
        options={comboboxOptions}
        selected={selectedCourseId || ''}
        onSelect={handleCourseSelect}
        placeholder={messages.elective_placeholder()}
        searchPlaceholder={messages.elective_search()}
        noResultsText={messages.elective_no_results()}
        minWidth="100%"
      />
    </div>
  </div>
</div>

{#if selectedCourse}
  {#if warningType}
    <PrerequisiteWarning showBorder={true} type={warningType} />
  {/if}
  
  <PrerequisiteList prerequisites={selectedCourse.prerequisites || []} assessmentLevelPassed={selectedCourse.assessmentLevelPassed} />
  <ActionButtons courseId={selectedCourse.id} />
{/if}
