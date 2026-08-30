<script lang="ts">
import * as messages from '$lib/paraglide/messages';

let {
	showBorder = false,
	type = 'later-prerequisites',
}: {
	showBorder?: boolean;
	type?: 'later-prerequisites' | 'missing-prerequisites' | 'assessment-stage';
} = $props();

const warningMessages = {
	'later-prerequisites': {
		title: () => messages.warning_later_title(),
		message: () => messages.warning_later_message(),
	},
	'missing-prerequisites': {
		title: () => messages.warning_missing_title(),
		message: () => messages.warning_missing_message(),
	},
	'assessment-stage': {
		title: () => messages.warning_assessment_title(),
		message: () => messages.warning_assessment_message(),
	},
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
            {currentWarning.title()}
          </div>
          <div class="text-red-700 dark:text-red-300">
            {currentWarning.message()}
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
          {currentWarning.title()}
        </div>
        <div class="text-red-700 dark:text-red-300">
          {currentWarning.message()}
        </div>
      </div>
    </div>
  </div>
{/if}
