<script lang="ts">
  import { onMount } from 'svelte';
  import { courseStore } from '$lib/stores/courseStore.svelte';
  import { getEctsRequirements } from '$lib/data/ects-requirements';
  import TemplateSelector from './TemplateSelector.svelte';
  import SettingsSidebar from '../sidebar/SettingsSidebar.svelte';
  import ProgressAnalytics from './ProgressAnalytics.svelte';
  import Tooltip from '../ui/Tooltip.svelte';
  import AccountMenu from './AccountMenu.svelte';

  let programDropdownOpen = $state(false);
  let settingsSidebarOpen = $state(false);
  let analyticsOpen = $state(false);
  
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
  
  
  function toggleSettings() {
    settingsSidebarOpen = !settingsSidebarOpen;
  }

  const plannedCredits = $derived(courseStore.totalCredits);
  const passedEcts = $derived(courseStore.completedCredits);
  const requiredEcts = $derived(
    getEctsRequirements(courseStore.currentTemplate.studiengang)?.total ?? 0
  );
  const attended = $derived(courseStore.attendedCredits);
  const ectsTooltip = $derived(
    [
      `${passedEcts} ECTS completed`,
      `${plannedCredits} ECTS in plan`,
      `${attended} ECTS attended (failed)`
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

    <div class="relative program-dropdown">
      <button 
        data-tour="program"
        onclick={() => programDropdownOpen = !programDropdownOpen}
        class="flex h-9 items-center gap-2 rounded-lg border border-border-primary bg-transparent px-3 py-2 text-text-primary hover:bg-bg-secondary transition-colors"
        >
        <div class="i-lucide-graduation-cap h-4 w-4 text-text-primary"></div>
        <span class="hidden sm:inline text-sm font-medium text-text-primary">Study plan</span>
      </button>
      
      {#if programDropdownOpen}
        <div
          class="fixed inset-x-4 top-[64px] z-50 rounded-lg border border-border-primary bg-bg-primary p-3 shadow-2xl overflow-visible
                 sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:mt-1 sm:w-80 sm:shadow-lg sm:max-h-[70vh] sm:overflow-visible"
        >
          <div class="text-xs font-medium text-text-secondary mb-2">Study plan</div>
          <div class="border-b border-border-primary mb-3"></div>
          <div class="space-y-4">
            <TemplateSelector />
          </div>
        </div>
      {/if}
    </div>

    <!-- ECTS progress badge -->
    <button
      data-tour="progress"
      onclick={() => (analyticsOpen = true)}
      class="flex h-9 items-center gap-1.5 rounded-md border border-border-primary bg-bg-secondary px-3 py-2 cursor-pointer hover:bg-bg-secondary/70 hover:shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
      title={ectsTooltip}
      aria-label="Open progress analytics"
    >
      <span class="text-xs font-bold text-text-primary">{requiredEcts > 0 ? `${passedEcts} / ${requiredEcts} ECTS` : `${passedEcts} ECTS`}</span>
    </button>


    <!-- cloud sync account -->
    <AccountMenu />

    <!-- settings button -->
    <Tooltip text="Settings & help">
      <button
        onclick={toggleSettings}
        class="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-bg-secondary transition-colors text-text-primary"
        aria-label="Settings & help"
      >
        <div class="i-lucide-settings h-4 w-4 text-text-primary"></div>
      </button>
    </Tooltip>
  </div>
</header>

<!-- settings sidebar -->
<SettingsSidebar bind:isOpen={settingsSidebarOpen} />
<ProgressAnalytics bind:isOpen={analyticsOpen} />
