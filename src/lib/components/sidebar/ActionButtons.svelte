<script lang="ts">
  import { progressStore } from '$lib/stores/progressStore.svelte';
  import { computeStatuses } from '$lib/utils/status';
  import { courseStore } from '$lib/stores/courseStore.svelte';
  import { COURSES, evaluateCoursePrerequisites } from '$lib/data/courses';

  let { courseId, isElectiveSlot = false }: { courseId: string; isElectiveSlot?: boolean } = $props();

  const isAttended = $derived(progressStore.isAttended(courseId));
  const isCompleted = $derived(progressStore.isCompleted(courseId));
  const statuses = $derived(computeStatuses(courseStore.currentTemplate, courseStore.userSelections, progressStore.attendedSet, progressStore.completedSet));
  const isLocked = $derived(statuses[courseId] === "locked");
  
  // check if prerequisites are met
  const course = $derived(COURSES.find(c => c.id === courseId));
  const prerequisitesMet = $derived.by(() => {
    if (!course) return false;
    const userProgress = { 
      attended: progressStore.attendedSet, 
      completed: progressStore.completedSet 
    };
    return evaluateCoursePrerequisites(course, userProgress);
  });
</script>

<div class="border-t border-border-primary pt-4 space-y-2">
  <button 
    onclick={() => progressStore.markAttended(courseId)}
    disabled={isLocked || isCompleted || !prerequisitesMet}
    class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all {(isLocked || isCompleted || !prerequisitesMet)
      ? 'bg-gray-100 text-gray-400 border-2 border-gray-200 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700'
      : isAttended 
        ? 'bg-yellow-200 text-yellow-900 border-2 border-yellow-400 hover:bg-yellow-300 dark:bg-yellow-800 dark:text-yellow-100 dark:border-yellow-500 dark:hover:bg-yellow-700' 
        : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700'
    }"
  >
    {#if isAttended}
      <div class="i-lucide-check"></div>
      Attended
    {:else}
      <div class="i-lucide-eye"></div>
      Mark as Attended
    {/if}
  </button>
  
  <button 
    onclick={() => progressStore.markCompleted(courseId)}
    disabled={isLocked || !prerequisitesMet}
    class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all {(isLocked || !prerequisitesMet)
      ? 'bg-gray-100 text-gray-400 border-2 border-gray-200 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700'
      : isCompleted
        ? 'bg-green-200 text-green-900 border-2 border-green-400 hover:bg-green-300 dark:bg-green-800 dark:text-green-100 dark:border-green-500 dark:hover:bg-green-700'
        : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700'
    }"
  >
    {#if isCompleted}
      <div class="i-lucide-check-circle"></div>
      Completed
    {:else}
      <div class="i-lucide-circle-check"></div>
      Mark as Completed
    {/if}
  </button>
</div>
