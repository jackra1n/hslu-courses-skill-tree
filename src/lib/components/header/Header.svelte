<script lang="ts">
  import { getTotalCredits } from '$lib/stores/courseStore.svelte';
  import { uiStore } from '$lib/stores/uiStore.svelte';
  import { courseStore } from '$lib/stores/courseStore.svelte';
  import { getTheme, themeStore } from '$lib/stores/theme.svelte';
  import TemplateSelector from './TemplateSelector.svelte';
  
  const totalCredits = $derived(getTotalCredits());
  const showCourseTypeBadges = $derived(uiStore.showCourseTypeBadges);
  const showShortNamesOnly = $derived(courseStore.showShortNamesOnly);
  const currentTheme = $derived(getTheme());
  
  let programDropdownOpen = $state(false);
  let settingsDropdownOpen = $state(false);
  
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.program-dropdown') && programDropdownOpen) {
      programDropdownOpen = false;
    }
    if (!target.closest('.settings-dropdown') && settingsDropdownOpen) {
      settingsDropdownOpen = false;
    }
  }
  
  $effect(() => {
    if (programDropdownOpen || settingsDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  });
  
  function toggleTheme() {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    themeStore.set(newTheme);
  }
  
  function toggleCourseNames() {
    courseStore.toggleShortNames();
  }
  
  function toggleCourseBadges() {
    uiStore.toggleCourseTypeBadges();
  }
  
  function toggleAssessmentInfo() {
    uiStore.toggleAssessmentInfo();
  }
</script>

<header class="flex items-center justify-between border-b border-border-primary bg-bg-primary px-4 py-3">
  <div class="flex items-center gap-3">
    <div>
      <h1 class="text-lg font-semibold leading-none text-text-primary">HSLU Courses Skill Tree</h1>
      <p class="text-xs text-text-secondary">Track your progress through courses</p>
    </div>
  </div>

  <div class="flex items-center gap-2">
    <div class="relative program-dropdown">
      <button 
        onclick={() => programDropdownOpen = !programDropdownOpen}
        class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-primary bg-transparent hover:bg-bg-secondary transition-colors text-text-primary"
      >
        <div class="i-lucide-graduation-cap h-4 w-4 text-text-primary"></div>
        <span class="hidden sm:inline text-sm font-medium text-text-primary">Program</span>
      </button>
      
      {#if programDropdownOpen}
        <div class="absolute top-full right-0 mt-1 w-80 bg-bg-primary border border-border-primary rounded-lg shadow-lg z-50 p-3">
          <div class="text-xs font-medium text-text-secondary mb-2">Program Selection</div>
          <div class="border-b border-border-primary mb-3"></div>
          <div class="space-y-4">
            <TemplateSelector />
          </div>
        </div>
      {/if}
    </div>

    <!-- ECTS progress badge -->
    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary rounded-md border border-border-primary">
      <span class="text-xs font-medium text-text-primary">{totalCredits} ECTS Total</span>
    </div>

    <div class="h-6 w-px bg-border-primary"></div>

    <!-- settings dropdown -->
    <div class="relative settings-dropdown">
      <button 
        onclick={() => settingsDropdownOpen = !settingsDropdownOpen}
        class="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-bg-secondary transition-colors text-text-primary"
        aria-label="View settings"
      >
        <div class="i-lucide-settings2 h-4 w-4 text-text-primary"></div>
      </button>
      
      {#if settingsDropdownOpen}
        <div class="absolute top-full right-0 mt-1 w-56 bg-bg-primary border border-border-primary rounded-lg shadow-lg z-50 p-2">
          <div class="text-xs font-medium text-text-secondary mb-2">View Settings</div>
          <div class="border-b border-border-primary mb-3"></div>
          <div class="space-y-1">
            <button 
              onclick={() => { toggleCourseNames(); settingsDropdownOpen = false; }}
              class="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-bg-secondary rounded transition-colors text-text-primary"
            >
              <div class="w-4 h-4 flex items-center justify-center">
                {#if !showShortNamesOnly}
                  <div class="i-lucide-check h-4 w-4 text-green-500"></div>
                {/if}
              </div>
              Show Full Course Names
            </button>
            <button 
              onclick={() => { toggleCourseBadges(); settingsDropdownOpen = false; }}
              class="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-bg-secondary rounded transition-colors text-text-primary"
            >
              <div class="w-4 h-4 flex items-center justify-center">
                {#if showCourseTypeBadges}
                  <div class="i-lucide-check h-4 w-4 text-green-500"></div>
                {/if}
              </div>
              Show Course Badges
            </button>
            <div class="border-b border-border-primary my-1"></div>
            <button 
              onclick={() => { toggleAssessmentInfo(); settingsDropdownOpen = false; }}
              class="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-bg-secondary rounded transition-colors text-text-primary"
            >
              <div class="w-4 h-4 flex items-center justify-center">
                <div class="i-lucide-info h-4 w-4 text-text-primary"></div>
              </div>
              Assessment Info
            </button>
          </div>
        </div>
      {/if}
    </div>

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
  </div>
</header>
