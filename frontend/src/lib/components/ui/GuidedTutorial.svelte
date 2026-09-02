<script lang="ts">
import { type Driver, type DriveStep, driver } from 'driver.js';
import { onDestroy, onMount, tick } from 'svelte';
import 'driver.js/dist/driver.css';
import * as m from '$lib/paraglide/messages';
import { canvasCommands } from '$lib/stores/canvasCommands.svelte';
import { tutorialRequested, uiStore } from '$lib/stores/uiStore.svelte';

const SEEN_KEY = 'hslu-skill-tree-tutorial-seen';

// Built per run so the popovers pick up the active locale.
function buildSteps(): DriveStep[] {
	return [
		{
			popover: {
				title: m.tutorial_welcome_title(),
				description: m.tutorial_welcome_description(),
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
			onHighlightStarted: async (element) => {
				if (!(element instanceof Element)) return;
				// Pan the canvas to the course node. The command resolves once
				// the animated transition has finished, so the highlight box is
				// computed against the settled viewport, not mid-animation.
				await canvasCommands.current?.centerOnElement(element);
				await tick();
				driverInstance?.refresh();
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
let bodyObserver: MutationObserver | null = null;
let nodeObserver: MutationObserver | null = null;

function waitForAbsent(selector: string, timeout = 0): Promise<void> {
	return new Promise((resolve) => {
		if (!document.querySelector(selector)) {
			resolve();
			return;
		}

		const finish = () => {
			observer.disconnect();
			if (bodyObserver === observer) bodyObserver = null;
			if (timeoutId !== undefined) clearTimeout(timeoutId);
			resolve();
		};

		const observer = new MutationObserver(() => {
			if (!document.querySelector(selector)) finish();
		});
		bodyObserver = observer;
		observer.observe(document.body, { childList: true, subtree: true });

		const timeoutId = timeout > 0 ? setTimeout(finish, timeout) : undefined;
	});
}

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

async function runTutorial() {
	if (starting || driverInstance?.isActive()) return;
	starting = true;

	try {
		await tick();
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => resolve()),
		);

		// Wait for the first course node (bounded) and for the blocking mobile
		// warning overlay to be gone so Driver.js never competes with it.
		await Promise.all([
			waitForNode('.svelte-flow__node-custom', 2000),
			waitForAbsent('[data-mobile-warning]'),
		]);

		if (driverInstance?.isActive()) return;

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
			onDestroyed: () => {
				localStorage.setItem(SEEN_KEY, 'true');
				driverInstance = null;
			},
		});

		driverInstance.drive();
	} finally {
		starting = false;
	}
}

onMount(() => {
	if (localStorage.getItem(SEEN_KEY) !== 'true') {
		runTutorial();
	}
});

$effect(() => {
	if (tutorialRequested()) {
		uiStore.consumeTutorialRequest();
		runTutorial();
	}
});

onDestroy(() => {
	bodyObserver?.disconnect();
	nodeObserver?.disconnect();
	if (driverInstance) {
		driverInstance.destroy();
		driverInstance = null;
	}
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

  :global(.hslu-tutorial-popover .driver-popover-description .hslu-github-link:hover),
  :global(.hslu-tutorial-popover .driver-popover-description .hslu-github-link:focus) {
    background-color: color-mix(in srgb, rgb(var(--bg-secondary)) 70%, rgb(var(--bg-primary)));
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

  :global(.hslu-tutorial-popover .driver-popover-navigation-btns button:last-child) {
    background-color: rgb(37 99 235);
    border-color: rgb(37 99 235);
    color: #fff;
  }

  :global(.hslu-tutorial-popover .driver-popover-navigation-btns button:last-child:hover),
  :global(.hslu-tutorial-popover .driver-popover-navigation-btns button:last-child:focus) {
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
