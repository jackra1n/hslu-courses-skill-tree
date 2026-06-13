<script lang="ts">
  import { courseStore } from '$lib/stores/courseStore.svelte';
  import { COURSES, getCourseById, type Course } from '$lib/data/courses';
  import { SEASON_LABELS, type Season } from '$lib/data/season';
  import PrerequisiteList from '$lib/components/sidebar/PrerequisiteList.svelte';
  import ActionButtons from '$lib/components/sidebar/ActionButtons.svelte';
  import Combobox from '$lib/components/ui/Combobox.svelte';
  import PrerequisiteWarning from '$lib/components/ui/PrerequisiteWarning.svelte';
  import { hasPlanPrereqConflict } from '$lib/utils/prerequisite';
  import { hasMissingPrerequisites, hasAssessmentStageViolation } from '$lib/utils/status';

  let { slotId }: { slotId: string } = $props();

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
    COURSES.filter(course => {
      if (!slotNode) return false;
      if (selectedCourseId === course.id) return true;
      return courseStore.canSelectCourseForSlot(slotId, course.id);
    })
  );

  const slotSeason = $derived(slotNode ? courseStore.seasonOf(slotNode.semester) : null);

  function isOfferedIn(course: Course, season: Season): boolean {
    return !course.seasons || course.seasons.length === 0 || course.seasons.includes(season);
  }

  const comboboxOptions = $derived.by(() => {
    const options = availableCourses.map(course => {
      const outOfSeason = slotSeason !== null && !isOfferedIn(course, slotSeason);
      return {
        value: course.id,
        label: `${course.label} (${course.id}) — ${course.ects} ECTS`,
        keywords: [course.label, course.id],
        // keep an already-chosen course usable even if the start season later changed
        disabled: outOfSeason && course.id !== selectedCourseId,
        tooltip: outOfSeason ? `Only offered in ${formatSeasons(course.seasons)}` : undefined
      };
    });
    // out-of-season (disabled) courses sink to the bottom; order is otherwise stable
    return options.sort((a, b) => Number(a.disabled) - Number(b.disabled));
  });

  function formatSeasons(seasons: Season[] | undefined): string {
    if (!seasons || seasons.length === 0) return 'other semesters';
    return (['HS', 'FS'] as Season[]).filter(s => seasons.includes(s)).map(s => SEASON_LABELS[s]).join(' & ');
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
    Select Course
  </h3>
  <div class="space-y-3">
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label for="elective-course-select" class="text-sm font-medium text-text-primary">
          Choose a course for this slot
        </label>
        {#if selectedCourseId}
          <button 
            onclick={clearSelection}
            class="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Clear
          </button>
        {/if}
      </div>
      <Combobox
        options={comboboxOptions}
        selected={selectedCourseId || ''}
        onSelect={handleCourseSelect}
        placeholder="Select a course..."
        searchPlaceholder="Search courses..."
        noResultsText="No courses found"
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
