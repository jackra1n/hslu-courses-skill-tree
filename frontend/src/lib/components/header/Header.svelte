<script lang="ts">
import { onMount } from 'svelte';
import { getEctsRequirements } from '$lib/data/ects-requirements';
import * as m from '$lib/paraglide/messages';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import { measureHeaderHeight } from '$lib/utils/header-height';
import SettingsSidebar from '../sidebar/SettingsSidebar.svelte';
import Tooltip from '../ui/Tooltip.svelte';
import AccountMenu from './AccountMenu.svelte';
import ProgressAnalytics from './ProgressAnalytics.svelte';
import TemplateSelector from './TemplateSelector.svelte';

let programDropdownOpen = $state(false);
let activeSidebar = $state<'settings' | 'analytics' | null>(null);

const courseStore = getCourseStore();

function eventPathIncludesClass(event: MouseEvent, className: string): boolean {
	return event
		.composedPath()
		.some(
			(node) =>
				node instanceof HTMLElement && node.classList.contains(className),
		);
}

onMount(() => {
	const handleClickOutside = (event: MouseEvent) => {
		if (
			programDropdownOpen &&
			!eventPathIncludesClass(event, 'program-dropdown')
		) {
			programDropdownOpen = false;
		}
	};
	document.addEventListener('click', handleClickOutside);

	return () => {
		document.removeEventListener('click', handleClickOutside);
	};
});

function toggleProgramDropdown() {
	programDropdownOpen = !programDropdownOpen;
	if (programDropdownOpen) activeSidebar = null;
}

function toggleSettings() {
	activeSidebar = activeSidebar === 'settings' ? null : 'settings';
	if (activeSidebar === 'settings') programDropdownOpen = false;
}

function toggleAnalytics() {
	activeSidebar = activeSidebar === 'analytics' ? null : 'analytics';
	if (activeSidebar === 'analytics') programDropdownOpen = false;
}

const plannedCredits = $derived(courseStore.totalCredits);
const passedEcts = $derived(courseStore.completedCredits);
const requiredEcts = $derived(
	getEctsRequirements(courseStore.currentTemplate.studiengang)?.total ?? 0,
);
const attended = $derived(courseStore.attendedCredits);
const ectsTooltip = $derived(
	m.header_ects_tooltip({
		passed: passedEcts,
		planned: plannedCredits,
		attended,
	}),
);
</script>

<header {@attach measureHeaderHeight} class="relative z-[60] flex items-center justify-between gap-2 border-b border-border-primary bg-bg-primary px-3 py-2 sm:gap-4 sm:px-4 sm:py-3">
  <div class="flex min-w-0 items-center gap-3">
    <div class="leading-tight">
      <h1 class="text-lg font-semibold text-text-primary lg:hidden">{m.header_title_short()}</h1>
      <h1 class="hidden text-lg font-semibold text-text-primary lg:block">{m.header_title()}</h1>
      <p class="hidden text-xs text-text-secondary lg:block">{m.header_subtitle()}</p>
    </div>
  </div>


  <div class="flex flex-1 items-center justify-end gap-1 sm:gap-2">
    <a href="/courses" aria-label={m.browser_title()} title={m.browser_title()} class="flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border-primary text-sm font-medium text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-blue-500 lg:h-9 lg:w-auto lg:px-3">
      <span class="i-lucide-library h-4 w-4 shrink-0" aria-hidden="true"></span>
      <span class="hidden lg:inline">{m.browser_title()}</span>
      <span class="i-lucide-arrow-right hidden h-4 w-4 shrink-0 lg:block" aria-hidden="true"></span>
    </a>

    <div class="relative program-dropdown">
      <button 
        data-tour="program"
        onclick={toggleProgramDropdown}
        aria-label={m.header_study_plan()}
        aria-expanded={programDropdownOpen}
        class="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-primary bg-transparent px-2 py-2 text-text-primary hover:bg-bg-secondary hover:shadow-sm transition-all sm:px-3"
        >
        <div class="i-lucide-graduation-cap h-4 w-4 text-text-primary"></div>
        <span class="hidden sm:inline text-sm font-medium text-text-primary">{m.header_study_plan()}</span>
      </button>
      
      {#if programDropdownOpen}
        <div
          class="fixed inset-x-4 top-[var(--app-header-height)] z-50 rounded-lg border border-border-primary bg-bg-primary p-3 shadow-2xl overflow-visible
                 sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:mt-1 sm:w-80 sm:shadow-lg sm:max-h-[70vh] sm:overflow-visible"
        >
          <div class="text-xs font-medium text-text-secondary mb-2">{m.header_study_plan()}</div>
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
      onclick={toggleAnalytics}
      class="flex h-9 items-center gap-1.5 rounded-lg border border-border-primary bg-bg-secondary px-2 py-2 cursor-pointer hover:bg-bg-secondary/80 hover:shadow-sm transition-all sm:px-3"
      title={ectsTooltip}
      aria-label={m.header_open_progress_analytics()}
    >
      <span class="whitespace-nowrap text-xs font-bold text-text-primary">{requiredEcts > 0 ? `${passedEcts} / ${requiredEcts}` : passedEcts}<span class="hidden sm:inline"> ECTS</span></span>
    </button>


    <!-- cloud sync account -->
    <AccountMenu onInteract={() => {
      activeSidebar = null;
      programDropdownOpen = false;
    }} />

    <!-- settings button -->
    <Tooltip text={m.header_settings_help()} align="end">
      <button
        onclick={(event) => {
          toggleSettings();
          event.currentTarget.blur();
        }}
        class="flex cursor-pointer items-center justify-center w-8 h-8 rounded-lg hover:bg-bg-secondary hover:shadow-sm transition-all text-text-primary"
        aria-label={m.header_settings_help()}
      >
        <div class="i-lucide-settings h-4 w-4 text-text-primary"></div>
      </button>
    </Tooltip>
  </div>
</header>

<SettingsSidebar
  isOpen={activeSidebar === 'settings'}
  onClose={() => (activeSidebar = null)}
/>
<ProgressAnalytics
  isOpen={activeSidebar === 'analytics'}
  onClose={() => (activeSidebar = null)}
/>
