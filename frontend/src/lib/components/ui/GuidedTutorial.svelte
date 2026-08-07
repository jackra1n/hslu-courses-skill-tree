<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { driver, type Driver, type DriveStep } from 'driver.js';
  import 'driver.js/dist/driver.css';
  import { tutorialRequested, uiStore } from '$lib/stores/uiStore.svelte';

  const SEEN_KEY = 'hslu-skill-tree-tutorial-seen';

  const steps: DriveStep[] = [
    {
      popover: {
        title: 'Welcome to HSLU Courses Skill Tree',
        description:
          'This short tour shows you how to explore your study plan, track courses, switch programs, and review your progress.'
      }
    },
    {
      element: '[data-tour="skill-tree"]',
      popover: {
        title: 'Explore your study plan',
        description: 'Drag or scroll to move around the skill tree, and use the controls to zoom. Courses are arranged by semester and connected by prerequisites.'
      }
    },
    {
      element: '.svelte-flow__node',
      popover: {
        title: 'Open a course',
        description: 'Select any course to view its details and prerequisites. In the details panel, mark it as attended or completed to track your status.'
      }
    },
    {
      element: '[data-tour="program"]',
      popover: {
        title: 'Change your program',
        description: 'Choose your degree program, study model, start year, and semester, then load the matching curriculum.'
      }
    },
    {
      element: '[data-tour="progress"]',
      popover: {
        title: 'Review your progress',
        description: 'Open the ECTS summary to see passed, completed, and failed credits overall and by module type.'
      }
    }
  ];

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

      const timeoutId = timeout > 0
        ? setTimeout(finish, timeout)
        : undefined;
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
    if (starting || (driverInstance && driverInstance.isActive())) return;
    starting = true;

    try {
      await tick();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      // Wait for the first course node (bounded) and for the blocking mobile
      // warning overlay to be gone so Driver.js never competes with it.
      await Promise.all([
        waitForNode('.svelte-flow__node', 2000),
        waitForAbsent('[data-mobile-warning]')
      ]);

      if (driverInstance && driverInstance.isActive()) return;

      driverInstance = driver({
        showProgress: true,
        progressText: 'Step {{current}} of {{total}}',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Done',
        smoothScroll: true,
        allowClose: true,
        allowKeyboardControl: true,
        disableActiveInteraction: true,
        stagePadding: 8,
        stageRadius: 8,
        popoverClass: 'hslu-tutorial-popover',
        steps,
        onDestroyed: () => {
          localStorage.setItem(SEEN_KEY, 'true');
          driverInstance = null;
        }
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