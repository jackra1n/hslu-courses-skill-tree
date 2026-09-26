<script lang="ts">
import { type Driver, type DriveStep, driver } from 'driver.js';
import { flushSync, onDestroy, onMount, tick } from 'svelte';
import 'driver.js/dist/driver.css';
import * as m from '$lib/paraglide/messages';
import { canvasCommands } from '$lib/stores/canvasCommands.svelte';
import { uiStore } from '$lib/stores/uiStore.svelte';
import { readStorage, writeStorage } from '$lib/utils/storage';

const SEEN_KEY = 'hslu-skill-tree-tutorial-seen';

// Built per run so the popovers pick up the active locale.
function buildSteps(): DriveStep[] {
	return [
		{
			popover: {
				title: m.tutorial_welcome_title(),
				description: m.tutorial_welcome_description(),
				popoverClass: 'hslu-tutorial-popover hslu-welcome-popover',
				nextBtnText: m.tutorial_start(),
				prevBtnText: m.tutorial_explore_alone(),
				disableButtons: [],
				onPrevClick: finishTutorial,
				onNextClick: (_element, _step, { driver }) => {
					writeStorage(SEEN_KEY, 'true');
					driver.moveNext();
				},
				onPopoverRender: (popover) => {
					popover.progress.remove();
					popover.footerButtons.append(popover.previousButton);
					const disclaimer = document.createElement('p');
					disclaimer.className = 'hslu-welcome-note';
					disclaimer.textContent = m.disclaimer_text();
					const mobileTip = document.createElement('p');
					mobileTip.className = 'hslu-welcome-note hslu-welcome-mobile-tip';
					mobileTip.textContent = m.mobile_text();
					popover.description.append(disclaimer, mobileTip);
				},
			},
		},
		{
			element: '[data-tour="skill-tree"]',
			popover: {
				title: m.tutorial_explore_title(),
				description: m.tutorial_explore_description(),
			},
		},
		{
			element: '.svelte-flow__node-custom',
			popover: {
				title: m.tutorial_course_title(),
				description: m.tutorial_course_description(),
			},
			onHighlightStarted: (element) => {
				if (!(element instanceof Element)) return;
				// Refresh the highlight only after the canvas pan settles.
				centerHighlight(element).catch(handleTutorialError);
			},
		},
		{
			element: '[data-tour="program"]',
			popover: {
				title: m.tutorial_program_title(),
				description: m.tutorial_program_description(),
			},
		},
		{
			element: '[data-tour="progress"]',
			popover: {
				title: m.tutorial_progress_title(),
				description: m.tutorial_progress_description(),
			},
		},
		{
			element: '[data-tour="course-browser"]',
			popover: {
				title: m.tutorial_browser_title(),
				description: m.tutorial_browser_description(),
			},
		},
		{
			element: '[data-tour="account"]',
			popover: {
				title: m.tutorial_sync_title(),
				description: m.tutorial_sync_description(),
			},
		},
		{
			popover: {
				title: m.tutorial_open_source_title(),
				description: m.tutorial_open_source_description(),
			},
		},
	];
}

let driverInstance: Driver | null = null;
let starting = false;
let destroyed = false;
let nodeObserver: MutationObserver | null = null;

function waitForNode(selector: string, timeout: number): Promise<void> {
	return new Promise((resolve) => {
		if (document.querySelector(selector)) {
			resolve();
			return;
		}

		const finish = () => {
			observer.disconnect();
			if (nodeObserver === observer) nodeObserver = null;
			clearTimeout(timer);
			resolve();
		};

		const observer = new MutationObserver(() => {
			if (document.querySelector(selector)) finish();
		});
		nodeObserver = observer;
		observer.observe(document.body, { childList: true, subtree: true });

		const timer = setTimeout(finish, timeout);
	});
}

async function centerHighlight(element: Element): Promise<void> {
	await canvasCommands.current?.centerOnElement(element);
	await tick();
	driverInstance?.refresh();
}

function handleTutorialError(error: unknown): void {
	console.error('Failed to run guided tutorial', error);
	uiStore.tutorialNavigationOpen = false;
	driverInstance?.destroy();
	driverInstance = null;
}

function finishTutorial() {
	uiStore.tutorialNavigationOpen = false;
	// onDestroyed can be skipped before the first step animation settles.
	driverInstance?.destroy();
	driverInstance = null;
	writeStorage(SEEN_KEY, 'true');
}

async function runTutorial() {
	if (starting || driverInstance?.isActive()) return;
	starting = true;

	try {
		await tick();
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => resolve()),
		);

		// let the canvas mount before positioning the first highlighted step.
		await waitForNode('.svelte-flow__node-custom', 2000);
		if (destroyed || driverInstance?.isActive()) return;

		// driver.js interpolates {{current}}/{{total}} itself; feed the tokens
		// through the message as literal params.
		const progressText = m.tutorial_progress({
			current: '{{current}}',
			total: '{{total}}',
		});

		driverInstance = driver({
			showProgress: true,
			progressText,
			nextBtnText: m.tutorial_next(),
			prevBtnText: m.tutorial_back(),
			doneBtnText: m.tutorial_done(),
			smoothScroll: true,
			allowClose: true,
			allowKeyboardControl: true,
			disableActiveInteraction: true,
			stagePadding: 8,
			stageRadius: 8,
			popoverClass: 'hslu-tutorial-popover',
			steps: buildSteps(),
			onHighlightStarted: (_element, step) => {
				// reveal menu targets before driver.js measures their highlight.
				flushSync(() => {
					uiStore.tutorialNavigationOpen =
						step.element === '[data-tour="course-browser"]' ||
						step.element === '[data-tour="account"]';
				});
			},
			onDestroyStarted: finishTutorial,
		});

		driverInstance.drive();
	} finally {
		starting = false;
	}
}

onMount(() => {
	if (readStorage(SEEN_KEY) !== 'true') {
		runTutorial().catch(handleTutorialError);
	}
});

$effect(() => {
	if (uiStore.tutorialRequested) {
		uiStore.tutorialRequested = false;
		runTutorial().catch(handleTutorialError);
	}
});

onDestroy(() => {
	destroyed = true;
	nodeObserver?.disconnect();
	if (driverInstance) finishTutorial();
});
</script>

<style>
:global(.hslu-tutorial-popover) {
	background-color: rgb(var(--bg-primary));
	color: rgb(var(--text-primary));
	border: 1px solid rgb(var(--border-primary));
	border-radius: 0.75rem;
	box-shadow: 0 10px 30px rgb(0 0 0 / 0.2);
	padding: 1.25rem;
	min-width: 250px;
	max-width: 300px;
}

:global(.hslu-welcome-popover) {
	box-sizing: border-box;
	width: min(380px, calc(100vw - 32px));
	min-width: 0;
	max-width: 380px;
	max-height: calc(100dvh - 32px);
	overflow-y: auto;
}

:global(.hslu-welcome-note) {
	margin-top: 1rem;
	font-size: 0.8125rem;
	line-height: 1.5;
}

:global(.hslu-welcome-popover .driver-popover-navigation-btns) {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	width: 100%;
}

:global(.hslu-welcome-popover .driver-popover-navigation-btns button) {
	min-height: 44px;
	margin: 0;
	white-space: normal;
	text-align: center;
}

@media (min-width: 768px) {
	:global(.hslu-welcome-mobile-tip) {
		display: none;
	}
}

:global(.hslu-tutorial-popover .driver-popover-title) {
	color: rgb(var(--text-primary));
	font-size: 1.125rem;
	line-height: 1.4;
	margin-bottom: 0.5rem;
}

:global(.hslu-tutorial-popover .driver-popover-description) {
	color: rgb(var(--text-secondary));
	font-size: 0.875rem;
	line-height: 1.5;
}

:global(.hslu-tutorial-popover .driver-popover-description a) {
	color: rgb(37 99 235);
	text-decoration: underline;
}

:global(.hslu-tutorial-popover .driver-popover-description a:hover),
:global(.hslu-tutorial-popover .driver-popover-description a:focus) {
	color: rgb(29 78 216);
}

:global(.hslu-tutorial-popover .driver-popover-description .hslu-github-link) {
	display: flex;
	align-items: center;
	width: fit-content;
	gap: 0.375rem;
	margin: 0.25rem 0;
	padding: 0.25rem 0.625rem;
	border: 1px solid rgb(var(--border-primary));
	border-radius: 0.375rem;
	background-color: rgb(var(--bg-secondary));
	color: rgb(var(--text-primary));
	font-size: 0.8125rem;
	font-weight: 500;
	text-decoration: none;
	white-space: nowrap;
}

:global(
	.hslu-tutorial-popover .driver-popover-description .hslu-github-link:hover
),
:global(
	.hslu-tutorial-popover .driver-popover-description .hslu-github-link:focus
) {
	background-color: color-mix(
		in srgb,
		rgb(var(--bg-secondary)) 70%,
		rgb(var(--bg-primary))
	);
	border-color: rgb(var(--border-secondary));
	color: rgb(var(--text-primary));
}

:global(.hslu-tutorial-popover .driver-popover-close-btn) {
	color: rgb(var(--text-secondary));
}

:global(.hslu-tutorial-popover .driver-popover-close-btn:hover),
:global(.hslu-tutorial-popover .driver-popover-close-btn:focus) {
	color: rgb(var(--text-primary));
}

:global(.hslu-tutorial-popover .driver-popover-progress-text) {
	color: rgb(var(--text-secondary));
}

:global(.hslu-tutorial-popover .driver-popover-footer-btn) {
	background-color: transparent;
	border: 1px solid rgb(var(--border-primary));
	color: rgb(var(--text-primary));
	border-radius: 0.375rem;
	padding: 0.375rem 0.75rem;
	font-size: 0.8125rem;
	line-height: 1.3;
	text-decoration: none;
}

:global(.hslu-tutorial-popover .driver-popover-footer-btn:hover),
:global(.hslu-tutorial-popover .driver-popover-footer-btn:focus) {
	background-color: rgb(var(--bg-secondary));
}

:global(
	.hslu-tutorial-popover
		.driver-popover-navigation-btns
		.driver-popover-next-btn
) {
	background-color: rgb(37 99 235);
	border-color: rgb(37 99 235);
	color: #fff;
}

:global(
	.hslu-tutorial-popover
		.driver-popover-navigation-btns
		.driver-popover-next-btn:hover
),
:global(
	.hslu-tutorial-popover
		.driver-popover-navigation-btns
		.driver-popover-next-btn:focus
) {
	background-color: rgb(29 78 216);
	border-color: rgb(29 78 216);
}

:global(.hslu-tutorial-popover .driver-popover-arrow) {
	border-width: 6px;
	border-color: rgb(var(--bg-primary));
}

:global(.hslu-tutorial-popover .driver-popover-arrow-side-left) {
	border-color: rgb(var(--bg-primary)) transparent transparent transparent;
}

:global(.hslu-tutorial-popover .driver-popover-arrow-side-right) {
	border-color: transparent rgb(var(--bg-primary)) transparent transparent;
}

:global(.hslu-tutorial-popover .driver-popover-arrow-side-top) {
	border-color: transparent transparent rgb(var(--bg-primary)) transparent;
}

:global(.hslu-tutorial-popover .driver-popover-arrow-side-bottom) {
	border-color: transparent transparent transparent rgb(var(--bg-primary));
}
</style>
