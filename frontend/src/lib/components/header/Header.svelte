<script lang="ts">
import { onMount, tick } from 'svelte';
import { resolve } from '$app/paths';
import { getEctsRequirements } from '$lib/data/ects-requirements';
import * as m from '$lib/paraglide/messages';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import { tutorialNavigationOpen } from '$lib/stores/uiStore.svelte';
import { measureHeaderHeight } from '$lib/utils/header-height';
import SettingsSidebar from '../sidebar/SettingsSidebar.svelte';
import AccountMenu from './AccountMenu.svelte';
import ProgressAnalytics from './ProgressAnalytics.svelte';
import TemplateSelector from './TemplateSelector.svelte';

let programDropdownOpen = $state(false);
let activeSidebar = $state<'settings' | 'analytics' | null>(null);
let mobileMenuOpen = $state(false);
const navigationOpen = $derived(mobileMenuOpen || tutorialNavigationOpen());
let accountMenuOpen = $state(false);
let menuButton: HTMLButtonElement;
let programButton: HTMLButtonElement;
let navigation: HTMLElement;
const navigationId = $props.id();

function closeMobileMenu() {
	mobileMenuOpen = false;
	programDropdownOpen = false;
	accountMenuOpen = false;
}

async function toggleMobileMenu() {
	if (mobileMenuOpen || activeSidebar || programDropdownOpen) {
		activeSidebar = null;
		closeMobileMenu();
		return;
	}
	activeSidebar = null;
	mobileMenuOpen = true;
	await tick();
	navigation.querySelector<HTMLElement>('a, button')?.focus();
}

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
		if (mobileMenuOpen && !eventPathIncludesClass(event, 'header-navigation'))
			closeMobileMenu();
	};
	document.addEventListener('click', handleClickOutside);
	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape' && mobileMenuOpen) {
			closeMobileMenu();
			menuButton.focus();
		}
		if (event.key === 'Escape' && programDropdownOpen) {
			programDropdownOpen = false;
			programButton.focus();
		}
	};
	const handleFocus = (event: FocusEvent) => {
		if (
			mobileMenuOpen &&
			event.target instanceof Node &&
			!navigation.contains(event.target) &&
			event.target !== menuButton
		)
			closeMobileMenu();
	};
	const desktop = window.matchMedia('(min-width: 1024px)');
	const handleBreakpoint = () => closeMobileMenu();
	desktop.addEventListener('change', handleBreakpoint);
	document.addEventListener('keydown', handleKeydown);
	document.addEventListener('focusin', handleFocus);

	return () => {
		document.removeEventListener('click', handleClickOutside);
		document.removeEventListener('keydown', handleKeydown);
		document.removeEventListener('focusin', handleFocus);
		desktop.removeEventListener('change', handleBreakpoint);
	};
});

function toggleProgramDropdown() {
	const opening = !programDropdownOpen;
	closeMobileMenu();
	programDropdownOpen = opening;
	activeSidebar = null;
}

function toggleSettings() {
	closeMobileMenu();
	activeSidebar = activeSidebar === 'settings' ? null : 'settings';
}

function toggleAnalytics() {
	closeMobileMenu();
	activeSidebar = activeSidebar === 'analytics' ? null : 'analytics';
}

function closeSidebar() {
	activeSidebar = null;
	if (menuButton.getClientRects().length) menuButton.focus();
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

<header
	{@attach measureHeaderHeight}
	class="relative z-[60] flex items-center justify-between gap-3 border-b border-border-primary bg-bg-primary px-4 py-2 lg:gap-4 lg:py-3"
>
	<div class="min-w-0 leading-tight">
		<h1 class="text-lg font-semibold text-text-primary lg:hidden">
			{m.header_title_short()}
		</h1>
		<h1 class="hidden text-lg font-semibold text-text-primary lg:block">
			{m.header_title()}
		</h1>
		<p class="hidden text-xs text-text-secondary lg:block">
			{m.header_subtitle()}
		</p>
	</div>

	<div class="flex flex-1 items-center justify-end gap-2">
		<div class="relative program-dropdown">
			<button
				bind:this={programButton}
				data-tour="program"
				onclick={toggleProgramDropdown}
				aria-label={m.header_study_plan()}
				aria-expanded={programDropdownOpen}
				class="flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border-primary text-sm font-medium text-text-primary hover:bg-bg-secondary focus-visible:outline-blue-500 lg:h-9 lg:w-auto lg:px-3"
			>
				<span
					class="i-lucide-graduation-cap h-4 w-4 shrink-0"
					aria-hidden="true"
				></span>
				<span class="hidden lg:inline">{m.header_study_plan()}</span>
			</button>
			{#if programDropdownOpen}
				<div
					class="fixed inset-x-3 top-[var(--app-header-height)] max-h-[calc(100dvh-var(--app-header-height)-12px)] overflow-y-auto rounded-lg border border-border-primary bg-bg-primary p-3 shadow-xl lg:absolute lg:inset-x-auto lg:right-0 lg:top-full lg:mt-1 lg:w-80 lg:overflow-visible lg:shadow-lg"
				>
					<div class="space-y-4"><TemplateSelector /></div>
				</div>
			{/if}
		</div>
		<button
			data-tour="progress"
			onclick={toggleAnalytics}
			class="flex h-11 shrink-0 items-center rounded-lg border border-border-primary bg-bg-secondary px-3 text-xs font-bold text-text-primary hover:bg-bg-secondary/80 focus-visible:outline-blue-500 lg:order-1 lg:h-9"
			title={ectsTooltip}
			aria-label={m.header_open_progress_analytics()}
		>
			{requiredEcts > 0 ? `${passedEcts} / ${requiredEcts} ECTS` : `${passedEcts} ECTS`}
		</button>

		<button
			bind:this={menuButton}
			type="button"
			data-tour="navigation"
			onclick={toggleMobileMenu}
			aria-label={activeSidebar || programDropdownOpen ? m.common_close() : m.header_menu()}
			aria-expanded={navigationOpen || activeSidebar !== null || programDropdownOpen}
			aria-controls={navigationOpen ? navigationId : undefined}
			class="header-navigation program-dropdown flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border-primary text-text-primary hover:bg-bg-secondary focus-visible:outline-blue-500 lg:hidden"
		>
			<span
				class={`${navigationOpen || activeSidebar || programDropdownOpen ? 'i-lucide-x' : 'i-lucide-menu'} h-5 w-5`}
				aria-hidden="true"
			></span>
		</button>

		<nav
			bind:this={navigation}
			id={navigationId}
			aria-label={m.header_menu()}
			class={`header-navigation ${navigationOpen ? 'flex' : 'hidden'} fixed inset-x-3 top-[var(--app-header-height)] z-50 max-h-[calc(100dvh-var(--app-header-height)-12px)] flex-col gap-1 overflow-y-auto rounded-lg border border-border-primary bg-bg-primary p-2 shadow-xl lg:contents`}
		>
			<a
				data-tour="course-browser"
				href={resolve('/courses')}
				onclick={closeMobileMenu}
				class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-text-primary hover:bg-bg-secondary focus-visible:outline-blue-500 lg:order-first lg:mr-2 lg:min-h-9 lg:gap-2 lg:text-text-secondary lg:hover:text-text-primary"
			>
				<span
					class="i-lucide-library h-4 w-4 shrink-0 lg:hidden"
					aria-hidden="true"
				></span>
				<span class="lg:underline lg:underline-offset-4"
					>{m.browser_title()}</span
				>
				<span
					class="i-lucide-arrow-right ml-auto h-4 w-4 shrink-0 lg:ml-0"
					aria-hidden="true"
				></span>
			</a>

			<div class="lg:order-2">
				<AccountMenu
					navigationMenu
					bind:accountMenuOpen
					onInteract={() => {
          activeSidebar = null;
          programDropdownOpen = false;
        }}
				/>
			</div>

			<button
				onclick={toggleSettings}
				aria-label={m.header_settings_help()}
				title={m.header_settings_help()}
				class="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-text-primary hover:bg-bg-secondary focus-visible:outline-blue-500 lg:order-3 lg:min-h-9 lg:w-9 lg:justify-center lg:px-0"
			>
				<span
					class="i-lucide-settings h-4 w-4 shrink-0"
					aria-hidden="true"
				></span>
				<span class="lg:hidden">{m.header_settings_help()}</span>
			</button>
		</nav>
	</div>
</header>

<SettingsSidebar isOpen={activeSidebar === 'settings'} onClose={closeSidebar} />
<ProgressAnalytics
	isOpen={activeSidebar === 'analytics'}
	onClose={closeSidebar}
/>
