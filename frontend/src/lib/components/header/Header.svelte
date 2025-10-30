<script lang="ts">
  import { onMount } from 'svelte';
  import {
    totalCredits,
    calculatedTotalCredits,
    attendedCredits,
    completedCredits
  } from '$lib/stores/courseStore.svelte';
  import { uiStore } from '$lib/stores/uiStore.svelte';
  import { theme, themeStore } from '$lib/stores/theme.svelte';
  import TemplateSelector from './TemplateSelector.svelte';
  import SettingsSidebar from '../sidebar/SettingsSidebar.svelte';
  
  let programDropdownOpen = $state(false);
  let settingsSidebarOpen = $state(false);
  
  function eventPathIncludesClass(event: MouseEvent, className: string): boolean {
    return event.composedPath().some(
      (node) => node instanceof HTMLElement && node.classList.contains(className)
    );
  }

  onMount(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (programDropdownOpen && !eventPathIncludesClass(event, 'program-dropdown')) {
        programDropdownOpen = false;
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });
  
  function toggleTheme() {
    const newTheme = theme() === 'dark' ? 'light' : 'dark';
    themeStore.set(newTheme);
  }
  
  function toggleSettings() {
    settingsSidebarOpen = !settingsSidebarOpen;
  }

  const plannedCredits = $derived(totalCredits());
  const calculatedTotal = $derived(calculatedTotalCredits());
  const attended = $derived(attendedCredits());
  const completed = $derived(completedCredits());
  const ectsTooltip = $derived(
    [
      `${calculatedTotal} ECTS total (calculated)`,
      `${plannedCredits} ECTS in plan`,
      `${attended} ECTS attended (failed)`,
      `${completed} ECTS completed`
    ].join('\n')
  );
</script>

<header class="flex flex-wrap items-center justify-between gap-3 border-b border-border-primary bg-bg-primary px-4 py-2 sm:flex-nowrap sm:gap-4 sm:py-3">
  <div class="flex min-w-0 items-center gap-3">
    <div class="leading-tight">
      <h1 class="text-lg font-semibold text-text-primary sm:hidden">HCST</h1>
      <h1 class="hidden text-lg font-semibold text-text-primary sm:block">HSLU Courses Skill Tree</h1>
      <p class="hidden text-xs text-text-secondary sm:block">Track your progress through courses</p>
    </div>
  </div>

  <div class="flex flex-1 items-center justify-end gap-2">
    <button
      class="flex h-9 w-9 items-center justify-center rounded-lg border border-border-primary text-text-primary hover:bg-bg-secondary transition-colors md:hidden"
      aria-label="How to use"
      onclick={() => uiStore.toggleHowToGuide()}
    >
      <div class="i-lucide-info w-4 h-4"></div>
    </button>

    <div class="relative program-dropdown">
      <button 
        onclick={() => programDropdownOpen = !programDropdownOpen}
        class="flex h-9 items-center gap-2 rounded-lg border border-border-primary bg-transparent px-3 py-2 text-text-primary hover:bg-bg-secondary transition-colors"
        >
        <div class="i-lucide-graduation-cap h-4 w-4 text-text-primary"></div>
        <span class="hidden md:inline text-sm font-medium text-text-primary">Program</span>
      </button>
      
      {#if programDropdownOpen}
        <div
          class="fixed inset-x-4 top-[64px] z-50 rounded-lg border border-border-primary bg-bg-primary p-3 shadow-2xl overflow-visible
                 sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:mt-1 sm:w-80 sm:shadow-lg sm:max-h-[70vh] sm:overflow-visible"
        >
          <div class="text-xs font-medium text-text-secondary mb-2">Program Selection</div>
          <div class="border-b border-border-primary mb-3"></div>
          <div class="space-y-4">
            <TemplateSelector />
          </div>
        </div>
      {/if}
    </div>

    <!-- ECTS progress badge -->
    <div
      class="hidden items-center gap-1.5 rounded-md border border-border-primary bg-bg-secondary px-3 py-1.5 md:flex"
      title={ectsTooltip}
    >
      <span class="text-xs font-medium text-text-primary">{calculatedTotal} ECTS Total</span>
    </div>

    <div class="h-6 w-px bg-border-primary"></div>

    <!-- github link -->
    <a 
      href="https://github.com/jackra1n/hslu-courses-skill-tree"
      target="_blank"
      rel="noopener noreferrer"
      class="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-bg-secondary transition-colors text-text-primary"
      aria-label="View on GitHub"
    >
      <div class="i-lucide-github h-4 w-4 text-text-primary"></div>
    </a>

    <!-- theme toggle -->
    <button
      onclick={toggleTheme}
      class="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-bg-secondary transition-colors relative text-text-primary"
      aria-label="Toggle theme"
    >
      <div class="i-lucide-sun h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-text-primary"></div>
      <div class="i-lucide-moon h-4 w-4 absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-text-primary"></div>
    </button>

    <!-- settings button -->
    <button
      onclick={toggleSettings}
      class="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-bg-secondary transition-colors text-text-primary"
      aria-label="Settings"
    >
      <div class="i-lucide-settings h-4 w-4 text-text-primary"></div>
    </button>
  </div>
</header>

<!-- settings sidebar -->
<SettingsSidebar bind:isOpen={settingsSidebarOpen} />
