<script lang="ts">
import ConfirmationDialog from '$lib/components/ui/ConfirmationDialog.svelte';
import Dropdown from '$lib/components/ui/Dropdown.svelte';
import {
	getAvailableModels,
	getAvailablePlans,
	getTemplatesByProgram,
	type StudyModel,
} from '$lib/data/courses';
import { getProgramPlans, getPrograms } from '$lib/data/programs';
import {
	planIntroYear,
	resolvePlan,
	type Season,
	seasonLabel,
} from '$lib/data/season';
import * as messages from '$lib/paraglide/messages';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import { showCourseTypeBadges, uiStore } from '$lib/stores/uiStore.svelte';

const MODEL_LABELS: Record<string, () => string> = {
	fulltime: () => messages.model_fulltime(),
	parttime: () => messages.model_parttime(),
};
const MODEL_ORDER: StudyModel[] = ['fulltime', 'parttime'];
const SEASONS: Season[] = ['HS', 'FS'];

let showWarningDialog = $state(false);
let pendingProgram = $state<string | null>(null);
let pendingModel = $state<StudyModel | null>(null);
let pendingYear = $state<number | null>(null);
let pendingSeason = $state<Season | null>(null);

const courseStore = getCourseStore();

const program = $derived(
	pendingProgram ?? courseStore.currentTemplate.studiengang,
);
const model = $derived(pendingModel ?? courseStore.currentTemplate.modell);
const year = $derived(pendingYear ?? courseStore.startYear);
const season = $derived(pendingSeason ?? courseStore.startSeason);

const hasPendingChanges = $derived(
	program !== courseStore.currentTemplate.studiengang ||
		model !== courseStore.currentTemplate.modell ||
		year !== courseStore.startYear ||
		season !== courseStore.startSeason,
);

const isPlanCustomized = $derived.by(() => courseStore.isStudyPlanCustomized());

const targetTemplate = $derived.by(() => {
	const plan = resolvePlan(getAvailablePlans(program, model), { year, season });
	if (!plan) return undefined;
	return getTemplatesByProgram(program, model).find(
		(template) => template.plan === plan,
	);
});

const templateChanges = $derived(
	!!targetTemplate && targetTemplate.id !== courseStore.currentTemplate.id,
);
const canLoad = $derived(
	!!targetTemplate && (hasPendingChanges || isPlanCustomized),
);

const programOptions = $derived.by(() =>
	getPrograms().map((entry) => {
		const planCount = getProgramPlans(entry.shortName).length;
		return {
			value: entry.shortName,
			label: entry.name,
			disabled: planCount === 0,
			tooltip: planCount === 0 ? messages.template_coming_soon() : undefined,
		};
	}),
);

const modelOptions = $derived.by(() => {
	const availableModels = getAvailableModels(program);
	const candidates: string[] = [...MODEL_ORDER];
	availableModels.forEach((entry) => {
		if (!candidates.includes(entry)) candidates.push(entry);
	});
	return candidates.map((value) => {
		const isAvailable = availableModels.includes(value as StudyModel);
		return {
			value,
			label: MODEL_LABELS[value as keyof typeof MODEL_LABELS]?.() ?? value,
			disabled: !isAvailable,
			tooltip: !isAvailable ? messages.template_coming_soon() : undefined,
		};
	});
});

const yearOptions = $derived.by(() => {
	const introYears = getAvailablePlans(program, model)
		.map(planIntroYear)
		.filter((value): value is number => value !== null);
	const currentYear = new Date().getFullYear();
	const earliest = introYears.length ? Math.min(...introYears) : currentYear;
	const latest = Math.max(currentYear + 1, ...introYears);
	const years: number[] = [];
	for (let value = latest; value >= earliest; value--) years.push(value);
	return years.map((value) => ({ value: String(value), label: String(value) }));
});

const seasonOptions = $derived(
	SEASONS.map((value) => ({
		value,
		label: seasonLabel(value),
	})),
);

function toggleCourseNames() {
	courseStore.toggleShortNames();
}

function toggleCourseBadges() {
	uiStore.toggleCourseTypeBadges();
}

function handleProgramChange(value: string) {
	pendingProgram = value;
	const models = getAvailableModels(value);
	const current = pendingModel ?? courseStore.currentTemplate.modell;
	pendingModel = models.length
		? models.includes(current)
			? current
			: models[0]
		: null;
}

function handleModelChange(value: string) {
	pendingModel = value as StudyModel;
}

function handleYearChange(value: string) {
	pendingYear = Number(value);
}

function handleSeasonChange(value: string) {
	pendingSeason = value as Season;
}

function clearPending() {
	pendingProgram = null;
	pendingModel = null;
	pendingYear = null;
	pendingSeason = null;
}

function handleLoadClick() {
	if (!canLoad || !targetTemplate) return;
	// Reset the study plan when loading a different curriculum, or when
	// reloading the current one to discard customizations.
	const reset = templateChanges || !hasPendingChanges;
	if (isPlanCustomized && reset) {
		showWarningDialog = true;
		return;
	}
	applyStart(reset);
}

function applyStart(reset: boolean) {
	if (!targetTemplate) return;
	courseStore.applyStart(targetTemplate.id, year, season, reset);
	clearPending();
}

function confirmTemplateSwitch() {
	applyStart(true);
	showWarningDialog = false;
}

function cancelTemplateSwitch() {
	showWarningDialog = false;
}
</script>

<div class="space-y-3">
  <div class="space-y-1.5">
    <label for="program-select" class="text-xs font-medium text-text-secondary"
      >{messages.template_program()}</label
    >
    <Dropdown
      options={programOptions}
      selected={program}
      onSelect={handleProgramChange}
      minWidth="100%"
    />
  </div>

  <div class="space-y-1.5">
    <label for="model-select" class="text-xs font-medium text-text-secondary"
      >{messages.template_study_model()}</label
    >
    <Dropdown
      options={modelOptions}
      selected={model}
      onSelect={handleModelChange}
      minWidth="100%"
    />
  </div>

  <div class="grid grid-cols-2 gap-2">
    <div class="space-y-1.5">
      <label for="start-year-select" class="text-xs font-medium text-text-secondary"
        >{messages.template_start_year()}</label
      >
      <Dropdown
        options={yearOptions}
        selected={String(year)}
        onSelect={handleYearChange}
        minWidth="100%"
      />
    </div>
    <div class="space-y-1.5">
      <label for="start-season-select" class="text-xs font-medium text-text-secondary"
        >{messages.template_start_season()}</label
      >
      <Dropdown
        options={seasonOptions}
        selected={season}
        onSelect={handleSeasonChange}
        minWidth="100%"
      />
    </div>
  </div>

  <button
    onclick={handleLoadClick}
    disabled={!canLoad}
    class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors {canLoad
      ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
      : 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500'}"
  >
    <div class="i-lucide-download"></div>
    {messages.template_load()}
  </button>

  <div class="border-b border-border-primary"></div>

  <div class="space-y-3">
    <div class="text-xs font-medium text-text-secondary">{messages.template_view_options()}</div>
    <div class="flex items-center justify-between">
      <label for="show-full-course-names" class="text-sm text-text-primary">{messages.template_show_full_names()}</label>
      <button
        id="show-full-course-names"
        onclick={toggleCourseNames}
        class="relative w-11 h-6 rounded-full transition-colors duration-200 {!courseStore.showShortNamesOnly
          ? 'bg-blue-600 dark:bg-blue-500'
          : 'bg-gray-300 dark:bg-gray-600'}"
        aria-label={messages.template_toggle_full_names()}
        aria-pressed={!courseStore.showShortNamesOnly}
      >
        <div
          class="absolute top-0.5 w-5 h-5 bg-white dark:bg-gray-800 rounded-full shadow-sm transition-transform duration-200 {!courseStore.showShortNamesOnly
            ? 'translate-x-5'
            : 'translate-x-0.5'}"
        ></div>
      </button>
    </div>
    <div class="flex items-center justify-between">
      <label for="show-course-badges" class="text-sm text-text-primary">{messages.template_show_badges()}</label>
      <button
        id="show-course-badges"
        onclick={toggleCourseBadges}
        class="relative w-11 h-6 rounded-full transition-colors duration-200 {showCourseTypeBadges()
          ? 'bg-blue-600 dark:bg-blue-500'
          : 'bg-gray-300 dark:bg-gray-600'}"
        aria-label={messages.template_toggle_badges()}
        aria-pressed={showCourseTypeBadges()}
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

{#if showWarningDialog}
  <ConfirmationDialog
    title={messages.template_load_confirm_title()}
    message={messages.template_load_confirm_message()}
    confirmText={messages.template_load()}
    cancelText={messages.common_cancel()}
    variant="warning"
    onConfirm={confirmTemplateSwitch}
    onCancel={cancelTemplateSwitch}
  />
{/if}
