<script lang="ts">
  import { onMount } from 'svelte';

  let showPopup = $state(false);
  let dismissed = $state(false);

  onMount(() => {
    const dismissedStorage = localStorage.getItem('mobile-warning-dismissed');
    if (dismissedStorage) {
      const dismissedTime = parseInt(dismissedStorage);
      const now = Date.now();
      const twentyFourHoursInMs = 24 * 60 * 60 * 1000;
      
      if (now - dismissedTime < twentyFourHoursInMs) {
        dismissed = true;
        return;
      } else {
        localStorage.removeItem('mobile-warning-dismissed');
      }
    }

    const checkMobile = () => {
      if (window.innerWidth < 768 && !dismissed) {
        showPopup = true;
      } else {
        showPopup = false;
      }
    };

    checkMobile();

    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });

  function dismissPopup() {
    showPopup = false;
    dismissed = true;
    localStorage.setItem('mobile-warning-dismissed', Date.now().toString());
  }

  function continueAnyway() {
    showPopup = false;
  }
</script>

{#if showPopup}
  <div class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full mx-4 p-6 text-center">
      <div class="mb-4">
        <div class="mx-auto w-16 h-16 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mb-4">
          <svg class="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Mobile Not Optimized
        </h2>
        <p class="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
          This website is currently not optimized for mobile devices. The experience may be poor on small screens.
        </p>
      </div>
      
      <div class="space-y-3">
        <button
          onclick={dismissPopup}
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Got it, don't show again
        </button>
        <button
          onclick={continueAnyway}
          class="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Continue anyway
        </button>
      </div>
    </div>
  </div>
{/if}
