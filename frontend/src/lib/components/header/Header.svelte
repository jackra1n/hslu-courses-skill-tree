<script lang="ts">
import { onMount } from 'svelte';
import { getEctsRequirements } from '$lib/data/ects-requirements';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import SettingsSidebar from '../sidebar/SettingsSidebar.svelte';
import Tooltip from '../ui/Tooltip.svelte';
import AccountMenu from './AccountMenu.svelte';
import ProgressAnalytics from './ProgressAnalytics.svelte';
import TemplateSelector from './TemplateSelector.svelte';

let programDropdownOpen = $state(false);
let activeSidebar = $state<'settings' | 'analytics' | null>(null);
let headerElement: HTMLElement;

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
	const updateHeaderHeight = () => {
		document.documentElement.style.setProperty(
			'--app-header-height',
			`${headerElement.offsetHeight}px`,
		);
	};
	const resizeObserver = new ResizeObserver(updateHeaderHeight);

	document.addEventListener('click', handleClickOutside);
	resizeObserver.observe(headerElement);
	updateHeaderHeight();

	return () => {
		document.removeEventListener('click', handleClickOutside);
		resizeObserver.disconnect();
		document.documentElement.style.removeProperty('--app-header-height');
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
	[
		`${passedEcts} ECTS completed`,
		`${plannedCredits} ECTS in plan`,
		`${attended} ECTS attended (failed)`,
	].join('\n'),
);
</script>

<header bind:this={headerElement} class="relative z-[60] flex flex-wrap items-center justify-between gap-3 border-b border-border-primary bg-bg-primary px-4 py-2 sm:flex-nowrap sm:gap-4 sm:py-3">
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
        onclick={toggleProgramDropdown}
        class="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-primary bg-transparent px-3 py-2 text-text-primary hover:bg-bg-secondary hover:shadow-sm transition-all"
        >
        <div class="i-lucide-graduation-cap h-4 w-4 text-text-primary"></div>
        <span class="hidden sm:inline text-sm font-medium text-text-primary">Study plan</span>
      </button>
      
      {#if programDropdownOpen}
        <div
          class="fixed inset-x-4 top-[var(--app-header-height)] z-50 rounded-lg border border-border-primary bg-bg-primary p-3 shadow-2xl overflow-visible
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
      onclick={toggleAnalytics}
      class="flex h-9 items-center gap-1.5 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 cursor-pointer hover:bg-bg-secondary/80 hover:shadow-sm transition-all"
      title={ectsTooltip}
      aria-label="Open progress analytics"
    >
      <span class="text-xs font-bold text-text-primary">{requiredEcts > 0 ? `${passedEcts} / ${requiredEcts} ECTS` : `${passedEcts} ECTS`}</span>
    </button>


    <!-- cloud sync account -->
    <AccountMenu onInteract={() => {
      activeSidebar = null;
      programDropdownOpen = false;
    }} />

    <!-- settings button -->
    <Tooltip text="Settings & help" align="end">
      <button
        onclick={(event) => {
          toggleSettings();
          event.currentTarget.blur();
        }}
        class="flex cursor-pointer items-center justify-center w-8 h-8 rounded-lg hover:bg-bg-secondary hover:shadow-sm transition-all text-text-primary"
        aria-label="Settings & help"
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
