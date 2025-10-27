<script lang="ts">
  import { studyPlan, userSelections, courseStore } from '$lib/stores/courseStore.svelte';
  import { progressStore } from '$lib/stores/progressStore.svelte';
  import { uiStore } from '$lib/stores/uiStore.svelte';
  import { COURSES, getCourseById } from '$lib/data/courses';
  import PrerequisiteList from '$lib/components/sidebar/PrerequisiteList.svelte';
  import ActionButtons from '$lib/components/sidebar/ActionButtons.svelte';
  import Combobox from '$lib/components/ui/Combobox.svelte';
  import PrerequisiteWarning from '$lib/components/ui/PrerequisiteWarning.svelte';
  import { hasPlanPrereqConflict } from '$lib/utils/prerequisite';
  import { hasMissingPrerequisites, hasAssessmentStageViolation } from '$lib/utils/status';

  let { slotId }: { slotId: string } = $props();

  const selectedCourseId = $derived(userSelections()[slotId]);
  const selectedCourse = $derived.by(() => {
    if (!selectedCourseId) return null;
    return getCourseById(selectedCourseId) ?? null;
  });

  const slotNode = $derived(studyPlan().nodes[slotId]);

  const warningType = $derived.by(() => {
    if (!selectedCourse) return null;
    
    const plan = studyPlan();

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
      if (progressStore.hasCompletedInstance(course.id, studyPlan())) return false;

      const fixedNodes = Object.values(studyPlan().nodes).filter(
        node => node.kind === 'fixed' && node.courseId === course.id
      );
      const appearsFixed = fixedNodes.length > 0;

      if (appearsFixed) {
        if (!progressStore.hasAttendedInstance(course.id, studyPlan())) {
          return false;
        }
        
        const earliest = Math.min(...fixedNodes.map(node => node.semester));
        if (slotNode.semester <= earliest) {
          return false;
        }
      }

      return courseStore.canSelectCourseForSlot(slotId, course.id);
    })
  );

  const comboboxOptions = $derived(
    availableCourses.map(course => ({
      value: course.id,
      label: `${course.label} (${course.id}) — ${course.ects} ECTS`,
      keywords: [course.label, course.id]
    }))
  );

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
