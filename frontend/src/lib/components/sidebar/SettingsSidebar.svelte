<script lang="ts">
import ConfirmationDialog from '$lib/components/ui/ConfirmationDialog.svelte';
import LanguageSwitcher from '$lib/components/ui/LanguageSwitcher.svelte';
import Sidebar from '$lib/components/ui/Sidebar.svelte';
import ThemeSwitcher from '$lib/components/ui/ThemeSwitcher.svelte';
import { collectAppData, importAppData } from '$lib/data/persistence';
import * as m from '$lib/paraglide/messages';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import { progressStore } from '$lib/stores/progressStore.svelte';
import { uiStore } from '$lib/stores/uiStore.svelte';
import { downloadJson, pickTextFile } from '$lib/utils/file-transfer';

let { isOpen, onClose }: { isOpen: boolean; onClose: () => void } = $props();

let showResetProgressDialog = $state(false);
let showResetAllDataDialog = $state(false);
let importError = $state<string | null>(null);

const courseStore = getCourseStore();

function handleExport() {
	const date = new Date().toISOString().slice(0, 10);
	downloadJson(`hslu-skill-tree-${date}.json`, collectAppData());
}

async function handleImport() {
	importError = null;
	const text = await pickTextFile();
	if (text === null) return;
	const result = importAppData(text);
	if (!result.ok) {
		importError = result.error;
		return;
	}
	closeSidebar();
}

function closeSidebar() {
	onClose();
}

function toggleAssessmentInfo() {
	uiStore.toggleAssessmentInfo();
	closeSidebar();
}

function handleResetProgress() {
	showResetProgressDialog = true;
}

function confirmResetProgress() {
	const plan = courseStore.studyPlan;
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
	const template = courseStore.currentTemplate;
	courseStore.switchTemplate(template.id, true);
	const plan = courseStore.studyPlan;
	Object.keys(plan.nodes).forEach((slotId) => {
		progressStore.clearSlotStatus(slotId);
	});
	showResetAllDataDialog = false;
	closeSidebar();
}
</script>

<Sidebar {isOpen} {onClose} label={m.settings_title()}>
  <div class="flex h-full flex-col">

      <!-- content -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <div class="space-y-2">
          <a
            href="https://github.com/jackra1n/hslu-courses-skill-tree"
            target="_blank"
            rel="noopener noreferrer"
            onclick={closeSidebar}
            class="w-full flex items-center gap-3 px-3 py-2.5 text-base border border-border-primary bg-bg-secondary hover:bg-bg-secondary/80 rounded-lg transition-colors text-text-primary"
          >
            <div class="i-lucide-github h-4 w-4 text-text-primary"></div>
            <span>{m.settings_view_github()}</span>
            <div class="i-lucide-external-link h-4 w-4 text-text-secondary ml-auto"></div>
          </a>
          <button
            onclick={() => {
              closeSidebar();
              uiStore.requestTutorial();
            }}
            class="w-full flex items-center gap-3 px-3 py-2.5 text-base border border-border-primary bg-bg-secondary hover:bg-bg-secondary/80 rounded-lg transition-colors text-text-primary"
          >
            <div class="i-lucide-book-open h-4 w-4 text-text-primary"></div>
            <span>{m.settings_start_tutorial()}</span>
          </button>
          <div class="flex w-full items-center justify-between gap-3 px-1 py-2 text-base text-text-primary">
            <span>{m.settings_theme()}</span>
            <ThemeSwitcher />
          </div>
          <div class="flex w-full items-center justify-between gap-3 px-1 py-2 text-base text-text-primary">
            <span>{m.settings_language()}</span>
            <LanguageSwitcher />
          </div>
        </div>

        <div class="border-b border-border-primary"></div>

        <!-- Data Management -->
        <div>
          <div class="text-base font-bold text-text-primary mb-4">{m.settings_data_management()}</div>
          <div class="space-y-2">
            <button
              onclick={handleExport}
              class="w-full flex items-center gap-3 px-3 py-2.5 text-base border border-border-primary bg-bg-secondary hover:bg-bg-secondary/80 rounded-lg transition-colors text-text-primary"
            >
              <div class="i-lucide-download h-4 w-4"></div>
              <span>{m.settings_export_data()}</span>
            </button>
            <button
              onclick={handleImport}
              class="w-full flex items-center gap-3 px-3 py-2.5 text-base border border-border-primary bg-bg-secondary hover:bg-bg-secondary/80 rounded-lg transition-colors text-text-primary"
            >
              <div class="i-lucide-upload h-4 w-4"></div>
              <span>{m.settings_import_data()}</span>
            </button>
            {#if importError}
              <p class="text-sm text-red-500">{importError}</p>
            {/if}
            <div class="border-b border-border-primary my-3"></div>
            <button
              onclick={handleResetProgress}
              class="w-full flex items-center gap-3 px-3 py-2.5 text-base border border-border-primary bg-bg-secondary hover:bg-bg-secondary/80 rounded-lg transition-colors text-text-primary"
            >
              <div class="i-lucide-refresh-cw h-4 w-4 text-text-primary"></div>
              <span>{m.settings_reset_progress()}</span>
            </button>
            <button
              onclick={handleResetAllData}
              class="w-full flex items-center gap-3 px-3 py-2.5 text-base border border-red-500/50 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors text-red-500"
            >
              <div class="i-lucide-trash-2 h-4 w-4 text-red-500"></div>
              <span>{m.settings_reset_all_data()}</span>
            </button>
          </div>
        </div>

        <div class="border-b border-border-primary"></div>

        <!-- Resources -->
        <div>
          <div class="text-base font-bold text-text-primary mb-4">{m.settings_resources()}</div>
          <div class="space-y-2">
            <button
            onclick={toggleAssessmentInfo}
            class="w-full flex items-center gap-3 px-3 py-2.5 text-base border border-border-primary bg-bg-secondary hover:bg-bg-secondary/80 rounded-lg transition-colors text-text-primary"
            >
            <div class="i-lucide-info h-4 w-4 text-text-primary"></div>
            <span>{m.settings_assessment_info()}</span>
          </button>
          </div>
        </div>

      </div>
    </div>
</Sidebar>

<!-- Confirmation Dialogs -->
{#if showResetProgressDialog}
  <ConfirmationDialog
    title={m.settings_reset_progress()}
    message={m.settings_reset_progress_message()}
    confirmText={m.settings_reset_progress()}
    cancelText={m.common_cancel()}
    onConfirm={confirmResetProgress}
    onCancel={() => showResetProgressDialog = false}
    variant="warning"
  />
{/if}

{#if showResetAllDataDialog}
  <ConfirmationDialog
    title={m.settings_reset_all_data()}
    message={m.settings_reset_all_data_message()}
    confirmText={m.settings_reset_all_data()}
    cancelText={m.common_cancel()}
    onConfirm={confirmResetAllData}
    onCancel={() => showResetAllDataDialog = false}
    variant="danger"
  />
{/if}
