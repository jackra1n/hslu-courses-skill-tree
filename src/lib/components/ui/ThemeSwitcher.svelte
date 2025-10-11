<script lang="ts">
  import { getTheme, themeStore, type Theme } from '$lib/stores/theme.svelte';

  const themeOptions = [
    { value: 'light' as Theme, label: 'Light', icon: 'i-lucide-sun' },
    { value: 'dark' as Theme, label: 'Dark', icon: 'i-lucide-moon' },
    { value: 'system' as Theme, label: 'System', icon: 'i-lucide-monitor' }
  ];

  let isOpen = $state(false);

  function toggleDropdown() {
    isOpen = !isOpen;
  }

  function selectTheme(selectedTheme: Theme) {
    themeStore.set(selectedTheme);
    isOpen = false;
  }

	const getCurrentOption = $derived(() => {
		return themeOptions.find(option => option.value === getTheme()) || themeOptions[0];
	});
</script>

<div class="relative">
  <button
    onclick={toggleDropdown}
    class="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
    aria-label="Select theme"
    aria-expanded={isOpen}
  >
    <div class="{getCurrentOption().icon} w-4 h-4"></div>
    <span class="text-sm font-medium">{getCurrentOption().label}</span>
    <div class="i-lucide-chevron-down w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}"></div>
  </button>

  {#if isOpen}
    <div class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
      {#each themeOptions as option}
        <button
          onclick={() => selectTheme(option.value)}
          class="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg {option.value === getTheme() ? 'bg-gray-100 dark:bg-gray-700' : ''}"
        >
          <div class="{option.icon} w-4 h-4"></div>
          <span class="text-sm font-medium">{option.label}</span>
                 {#if option.value === getTheme()}
            <div class="i-lucide-check w-4 h-4 ml-auto text-blue-500 dark:text-blue-400"></div>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
