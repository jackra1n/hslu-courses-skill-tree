<script lang="ts">
  let { 
    showBorder = false,
    type = 'later-prerequisites'
  }: { 
    showBorder?: boolean;
    type?: 'later-prerequisites' | 'missing-prerequisites' | 'assessment-stage';
  } = $props();

  const warningMessages = {
    'later-prerequisites': {
      title: 'Prerequisite Placement Warning',
      message: 'This course has prerequisites that are scheduled in the same or later semesters. You may not be able to take this course in the current semester.'
    },
    'missing-prerequisites': {
      title: 'Missing Prerequisites',
      message: 'This course requires prerequisites that are not in your study plan. Add the required courses first.'
    },
    'assessment-stage': {
      title: 'Assessment Stage Requirement',
      message: 'This course requires the assessment stage to be passed but is placed in the assessment stage semesters (1-2 for full-time, 1-3 for part-time).'
    }
  };

  const currentWarning = $derived(warningMessages[type]);
</script>

{#if showBorder}
  <div class="border-t border-border-primary pt-4">
    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
      <div class="flex items-start gap-2">
        <div class="i-lucide-alert-triangle text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0"></div>
        <div class="text-sm">
          <div class="font-medium text-red-800 dark:text-red-200 mb-1">
            {currentWarning.title}
          </div>
          <div class="text-red-700 dark:text-red-300">
            {currentWarning.message}
          </div>
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
    <div class="flex items-start gap-2">
      <div class="i-lucide-alert-triangle text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0"></div>
      <div class="text-sm">
        <div class="font-medium text-red-800 dark:text-red-200 mb-1">
          {currentWarning.title}
        </div>
        <div class="text-red-700 dark:text-red-300">
          {currentWarning.message}
        </div>
      </div>
    </div>
  </div>
{/if}
