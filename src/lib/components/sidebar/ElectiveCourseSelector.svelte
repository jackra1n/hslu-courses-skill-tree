<script lang="ts">
  import { courseStore } from '$lib/stores/courseStore.svelte';
  import { progressStore } from '$lib/stores/progressStore.svelte';
  import { COURSES, isPrerequisiteRequirement, isAndExpression, isOrExpression } from '$lib/data/courses';
  import PrerequisiteList from './PrerequisiteList.svelte';
  import ActionButtons from './ActionButtons.svelte';
  import Combobox from '$lib/components/ui/Combobox.svelte';

  let { slotId }: { slotId: string } = $props();

  const selectedCourseId = $derived(courseStore.userSelections[slotId]);
  const selectedCourse = $derived(selectedCourseId ? COURSES.find(c => c.id === selectedCourseId) : null);
  const currentTemplate = $derived(courseStore.currentTemplate);
  
  const hasLaterPrerequisites = $derived.by(() => {
    if (!selectedCourse) return false;
    
    const slot = currentTemplate.slots.find(s => s.id === slotId);
    if (!slot) return false;
    
    const checkPrerequisite = (prereq: any): boolean => {
      if (isPrerequisiteRequirement(prereq)) {
        return prereq.courses.some((courseId: string) => {
          const prereqSlot = currentTemplate.slots.find(s => s.courseId === courseId);
          const prereqElectiveSlot = currentTemplate.slots.find(s => 
            (s.type === "elective" || s.type === "major") && 
            courseStore.userSelections[s.id] === courseId
          );
          
          return (prereqSlot && prereqSlot.semester > slot.semester) || 
                 (prereqElectiveSlot && prereqElectiveSlot.semester > slot.semester);
        });
      } else if (isAndExpression(prereq)) {
        return prereq.operands.some(checkPrerequisite);
      } else if (isOrExpression(prereq)) {
        return prereq.operands.some(checkPrerequisite);
      }
      return false;
    };

    return selectedCourse.prereqs.some(checkPrerequisite);
  });

  const availableCourses = $derived(
    COURSES.filter(course => {
      if (selectedCourseId === course.id) {
        return true;
      }
      if (course.type === "Kernmodul" || course.type === "Projektmodul") {
        return false;
      }
      if (progressStore.isCompleted(course.id)) {
        return false;
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
  {#if hasLaterPrerequisites}
    <div class="border-t border-border-primary pt-4">
      <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
        <div class="flex items-start gap-2">
          <div class="i-lucide-alert-triangle text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0"></div>
          <div class="text-sm">
            <div class="font-medium text-red-800 dark:text-red-200 mb-1">
              Prerequisite Placement Warning
            </div>
            <div class="text-red-700 dark:text-red-300">
              This course has prerequisites that are scheduled in later semesters. 
              You may not be able to take this course in the current semester.
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
  
  <PrerequisiteList prereqs={selectedCourse.prereqs as any} />
  <ActionButtons courseId={selectedCourse.id} isElectiveSlot={true} />
{/if}
