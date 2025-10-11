<script lang="ts">
  import { courseStore } from '$lib/stores/courseStore.svelte';
  import { COURSES } from '$lib/data/courses';
  import PrerequisiteList from './PrerequisiteList.svelte';
  import ActionButtons from './ActionButtons.svelte';

  let { slotId }: { slotId: string } = $props();

  const selectedCourseId = $derived(courseStore.userSelections[slotId]);
  const selectedCourse = $derived(selectedCourseId ? COURSES.find(c => c.id === selectedCourseId) : null);

  function handleCourseSelect(e: Event) {
    const target = e.target as HTMLSelectElement;
    const courseId = target.value;
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
      <select 
        id="elective-course-select"
        value={selectedCourseId || ''}
        onchange={handleCourseSelect}
        class="w-full px-3 py-2 rounded-lg text-sm border border-border-primary bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select a course...</option>
        {#each COURSES as course}
          <option value={course.id}>{course.label} ({course.id}) - {course.ects} ECTS</option>
        {/each}
      </select>
    </div>
  </div>
</div>

{#if selectedCourse}
  <PrerequisiteList prereqs={selectedCourse.prereqs as any} />
  <ActionButtons courseId={selectedCourse.id} isElectiveSlot={true} />
{/if}
