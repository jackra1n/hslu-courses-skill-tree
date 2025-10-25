<script lang="ts">
  import { showShortNamesOnly, useELKLayout, courseStore } from '$lib/stores/courseStore.svelte';
  import { showMoreOptions, showCourseTypeBadges, uiStore } from '$lib/stores/uiStore.svelte';
</script>

{#if showMoreOptions()}
  <div class="border-b border-border-primary bg-bg-secondary px-6 py-4">
    <div class="max-w-4xl mx-auto">
      <h2 class="text-lg font-bold text-text-primary mb-3">Additional Options</h2>
      <div class="flex items-center gap-4">
        <button 
          onclick={() => uiStore.toggleAssessmentInfo()}
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-100 dark:hover:bg-blue-700"
        >
          <div class="i-lucide-info"></div>
          Assessment Info
        </button>
        <button 
          onclick={() => courseStore.toggleShortNames()}
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all {showShortNamesOnly() 
            ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-800 dark:text-green-100 dark:hover:bg-green-700'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
          }"
        >
          <div class="i-lucide-toggle-left"></div>
          {showShortNamesOnly() ? 'Short Names' : 'Full Names'}
        </button>
        <button 
          onclick={() => courseStore.toggleLayout()}
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all {useELKLayout() 
            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-800 dark:text-purple-100 dark:hover:bg-purple-700'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
          }"
        >
          <div class="i-lucide-network"></div>
          {useELKLayout() ? 'ELK Layout' : 'Semester Layout'}
        </button>
        <button 
          onclick={() => uiStore.toggleCourseTypeBadges()}
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all {showCourseTypeBadges() 
            ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-800 dark:text-indigo-100 dark:hover:bg-indigo-700'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
          }"
        >
          <div class="i-lucide-tag"></div>
          Course Type Badges
        </button>
      </div>
    </div>
  </div>
{/if}
