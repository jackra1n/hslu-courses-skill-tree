<script lang="ts">
import { fly } from 'svelte/transition';
import { browser } from '$app/environment';
import * as messages from '$lib/paraglide/messages';

let showToast = $state(false);

$effect(() => {
	if (browser) {
		const hasSeenDisclaimer = localStorage.getItem(
			'hslu-skill-tree-disclaimer-dismissed',
		);
		if (!hasSeenDisclaimer) {
			const showTimer = setTimeout(() => {
				showToast = true;
			}, 1000);

			return () => clearTimeout(showTimer);
		}
	}
});

$effect(() => {
	if (showToast && browser) {
		const autoHideTimer = setTimeout(() => {
			dismissToast();
		}, 30000);

		return () => clearTimeout(autoHideTimer);
	}
});

function dismissToast() {
	showToast = false;
	if (browser) {
		localStorage.setItem('hslu-skill-tree-disclaimer-dismissed', 'true');
	}
}
</script>

{#if showToast}
  <div class="absolute top-4 right-4 z-50 max-w-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4" transition:fly={{ x: 300, duration: 300 }}>
    <div class="flex items-start gap-3">
      <div class="flex-shrink-0">
        <div class="i-lucide-alert-triangle w-5 h-5 text-yellow-500"></div>
      </div>
      <div class="flex-1">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {messages.disclaimer_title()}
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {messages.disclaimer_text()}
        </p>
        <button 
          onclick={dismissToast}
          class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
        >
          {messages.common_got_it()}
        </button>
      </div>
      <button 
        onclick={dismissToast}
        aria-label={messages.common_close()}
      >
        <div class="i-lucide-x w-4 h-4"></div>
      </button>
    </div>
  </div>
{/if}
