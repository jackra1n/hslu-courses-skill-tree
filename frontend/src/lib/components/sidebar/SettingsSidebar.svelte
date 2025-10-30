<script lang="ts">
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { showShortNamesOnly, courseStore } from '$lib/stores/courseStore.svelte';
  import { showCourseTypeBadges, uiStore } from '$lib/stores/uiStore.svelte';
  import { progressStore } from '$lib/stores/progressStore.svelte';
  import { currentTemplate, courseStore as store, studyPlan } from '$lib/stores/courseStore.svelte';
  import ConfirmationDialog from '$lib/components/ui/ConfirmationDialog.svelte';

  let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();

  let showResetProgressDialog = $state(false);
  let showResetAllDataDialog = $state(false);

  function closeSidebar() {
    isOpen = false;
  }

  function toggleCourseNames() {
    courseStore.toggleShortNames();
  }

  function toggleCourseBadges() {
    uiStore.toggleCourseTypeBadges();
  }

  function toggleAssessmentInfo() {
    uiStore.toggleAssessmentInfo();
    closeSidebar();
  }

  function handleResetProgress() {
    showResetProgressDialog = true;
  }

  function confirmResetProgress() {
    const plan = studyPlan();
    Object.keys(plan.nodes).forEach((slotId) => {
      progressStore.clearSlotStatus(slotId);
    });
    showResetProgressDialog = false;
    closeSidebar();
  }

  function handleResetAllData() {
    showResetAllDataDialog = true;
  }

  function confirmResetAllData() {
    const template = currentTemplate();
    store.switchTemplate(template.id, true);
    const plan = studyPlan();
    Object.keys(plan.nodes).forEach((slotId) => {
      progressStore.clearSlotStatus(slotId);
    });
    showResetAllDataDialog = false;
    closeSidebar();
  }

  onMount(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        closeSidebar();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  });
</script>

<!-- backdrop -->
{#if isOpen}
  <div
    class="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200"
    onclick={closeSidebar}
    onkeydown={(e) => e.key === 'Escape' && closeSidebar()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
    tabindex="-1"
  ></div>
{/if}

<!-- sidebar -->
{#if isOpen}
  <aside
    class="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-bg-primary border-l border-border-primary shadow-2xl overflow-y-auto"
    transition:slide={{ axis: 'x', duration: 200 }}
  >
    <div class="flex flex-col h-full">
      <!-- header -->
      <div class="flex items-start justify-between p-6 ">
        <div class="flex-1">
          <h2 id="settings-title" class="text-lg font-semibold text-text-primary mb-1">Settings</h2>
          <p class="text-sm text-text-secondary">Customize your course skill tree experience</p>
        </div>
        <button
          onclick={closeSidebar}
          class="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-bg-secondary transition-colors text-text-primary flex-shrink-0"
          aria-label="Close settings"
        >
          <div class="i-lucide-x h-4 w-4"></div>
        </button>
      </div>

      <!-- content -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <!-- View Options -->
        <div>
          <div class="text-base font-bold text-text-primary mb-4">View Options</div>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label for="show-full-course-names" class="text-base text-text-primary">Show Full Course Names</label>
              <!-- Toggle Switch -->
              <button
                id="show-full-course-names"
                onclick={toggleCourseNames}
                class="relative w-11 h-6 rounded-full transition-colors duration-200 {!showShortNamesOnly()
                  ? 'bg-blue-600 dark:bg-blue-500'
                  : 'bg-gray-300 dark:bg-gray-600'}"
                aria-label="Toggle full course names"
              >
                <div
                  class="absolute top-0.5 w-5 h-5 bg-white dark:bg-gray-800 rounded-full shadow-sm transition-transform duration-200 {!showShortNamesOnly()
                    ? 'translate-x-5'
                    : 'translate-x-0.5'}"
                ></div>
              </button>
            </div>
            <div class="flex items-center justify-between">
              <label for="show-course-badges" class="text-base text-text-primary">Show Course Badges</label>
              <!-- Toggle Switch -->
              <button
                id="show-course-badges"
                onclick={toggleCourseBadges}
                class="relative w-11 h-6 rounded-full transition-colors duration-200 {showCourseTypeBadges()
                  ? 'bg-blue-600 dark:bg-blue-500'
                  : 'bg-gray-300 dark:bg-gray-600'}"
                aria-label="Toggle course badges"
              >
                <div
                  class="absolute top-0.5 w-5 h-5 bg-white dark:bg-gray-800 rounded-full shadow-sm transition-transform duration-200 {showCourseTypeBadges()
                    ? 'translate-x-5'
                    : 'translate-x-0.5'}"
                ></div>
              </button>
            </div>
          </div>
        </div>

        <div class="border-b border-border-primary"></div>

        <!-- Data Management -->
        <div>
          <div class="text-base font-bold text-text-primary mb-4">Data Management</div>
          <div class="space-y-2">
            <button
              disabled
              title="Coming soon"
              class="w-full flex items-center gap-3 px-3 py-2.5 text-base border border-border-primary bg-bg-secondary rounded-lg transition-colors text-text-secondary cursor-not-allowed opacity-50"
            >
              <div class="i-lucide-download h-4 w-4"></div>
              <span>Export Data</span>
              <div class="i-lucide-lock h-4 w-4 ml-auto"></div>
            </button>
            <button
              disabled
              title="Coming soon"
              class="w-full flex items-center gap-3 px-3 py-2.5 text-base border border-border-primary bg-bg-secondary rounded-lg transition-colors text-text-secondary cursor-not-allowed opacity-50"
            >
              <div class="i-lucide-import h-4 w-4"></div>
              <span>Import Data</span>
              <div class="i-lucide-lock h-4 w-4 ml-auto"></div>
            </button>
            <div class="border-b border-border-primary my-3"></div>
            <button
              onclick={handleResetProgress}
              class="w-full flex items-center gap-3 px-3 py-2.5 text-base border border-border-primary bg-bg-secondary hover:bg-bg-secondary/80 rounded-lg transition-colors text-text-primary"
            >
              <div class="i-lucide-refresh-cw h-4 w-4 text-text-primary"></div>
              <span>Reset Progress</span>
            </button>
            <button
              onclick={handleResetAllData}
              class="w-full flex items-center gap-3 px-3 py-2.5 text-base border border-red-500/50 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors text-red-500"
            >
              <div class="i-lucide-trash-2 h-4 w-4 text-red-500"></div>
              <span>Reset All Data</span>
            </button>
          </div>
        </div>

        <div class="border-b border-border-primary"></div>

        <!-- Resources -->
        <div>
          <div class="text-base font-bold text-text-primary mb-4">Resources</div>
          <div class="space-y-2">
            <button
            onclick={toggleAssessmentInfo}
            class="w-full flex items-center gap-3 px-3 py-2.5 text-base border border-border-primary bg-bg-secondary hover:bg-bg-secondary/80 rounded-lg transition-colors text-text-primary"
            >
            <div class="i-lucide-info h-4 w-4 text-text-primary"></div>
            <span>Assessment Information</span>
          </button>
          <a
            href="https://github.com/jackra1n/hslu-courses-skill-tree"
            target="_blank"
            rel="noopener noreferrer"
            onclick={closeSidebar}
            class="w-full flex items-center gap-3 px-3 py-2.5 text-base border border-border-primary bg-bg-secondary hover:bg-bg-secondary/80 rounded-lg transition-colors text-text-primary"
          >
            <div class="i-lucide-github h-4 w-4 text-text-primary"></div>
            <span>View on GitHub</span>
            <div class="i-lucide-external-link h-4 w-4 text-text-secondary ml-auto"></div>
          </a>
          </div>
        </div>

        <div class="border-b border-border-primary"></div>

        <!-- About -->
        <div>
          <div class="text-base font-bold text-text-primary mb-4">About</div>
          <div class="space-y-3 text-base text-text-secondary">
            <p>
              HSLU Courses Skill Tree helps you visualize and track your progress through university courses and their prerequisites.
            </p>
          </div>
        </div>
      </div>
    </div>
  </aside>
{/if}

<!-- Confirmation Dialogs -->
{#if showResetProgressDialog}
  <ConfirmationDialog
    title="Reset Progress"
    message="Are you sure you want to reset all progress? This will clear all completed and attended course statuses."
    confirmText="Reset Progress"
    cancelText="Cancel"
    onConfirm={confirmResetProgress}
    onCancel={() => showResetProgressDialog = false}
    variant="warning"
  />
{/if}

{#if showResetAllDataDialog}
  <ConfirmationDialog
    title="Reset All Data"
    message="Are you sure you want to reset all data? This will clear all progress AND your course selections. This cannot be undone."
    confirmText="Reset All Data"
    cancelText="Cancel"
    onConfirm={confirmResetAllData}
    onCancel={() => showResetAllDataDialog = false}
    variant="danger"
  />
{/if}
