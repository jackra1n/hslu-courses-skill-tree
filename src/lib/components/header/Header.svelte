<script lang="ts">
  import { getTotalCredits } from '$lib/stores/courseStore.svelte';
  import { uiStore } from '$lib/stores/uiStore.svelte';
  import TemplateSelector from './TemplateSelector.svelte';
  import ThemeSwitcher from '$lib/components/ui/ThemeSwitcher.svelte';
  
  const totalCredits = $derived(getTotalCredits());
  const showProgramSelector = $derived(uiStore.showProgramSelector);
</script>

<header class="border-b border-border-primary bg-bg-primary px-6 py-4 flex items-center justify-between">
  <div>
    <h1 class="text-2xl font-bold text-text-primary">HSLU Course Skill Tree</h1>
    <p class="text-sm text-text-secondary mt-1">Track your progress through courses</p>
  </div>
  <div class="flex items-center gap-4">
    <button 
      onclick={() => uiStore.toggleProgramSelector()}
      class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all {showProgramSelector 
        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-100 dark:hover:bg-blue-700'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
      }"
    >
      <div class="i-lucide-graduation-cap"></div>
      Program Selection
    </button>

    <div class="flex items-center gap-4 text-sm text-text-secondary">
      <div class="flex items-center gap-1.5">
        <div class="i-lucide-book-open"></div>
               <span>{totalCredits} ECTS Total</span>
      </div>
    </div>

    <button 
      onclick={() => uiStore.toggleMoreOptions()}
      class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
    >
      <div class="i-lucide-settings"></div>
      More Options
    </button>
    
    <ThemeSwitcher />
  </div>
</header>
