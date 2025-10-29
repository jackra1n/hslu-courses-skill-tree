<script lang="ts">
  import {
    currentTemplate,
    selectedPlan,
    courseStore,
  } from "$lib/stores/courseStore.svelte";
  import {
    getTemplatesByProgram,
    getAvailablePlans,
    getAvailableModels,
    type StudyModel
  } from "$lib/data/courses";
  import { PROGRAMS, PROGRAM_PLANS } from "$lib/data/programs";
  import Dropdown from "$lib/components/ui/Dropdown.svelte";
  import ConfirmationDialog from "$lib/components/ui/ConfirmationDialog.svelte";

  const MODEL_LABELS: Record<string, string> = {
    fulltime: "Fulltime",
    parttime: "Parttime",
  };
  const MODEL_ORDER: StudyModel[] = ["fulltime", "parttime"];

  let showWarningDialog = $state(false);
  let pendingProgram = $state<string | null>(null);
  let pendingModel = $state<StudyModel | null>(null);
  let pendingPlan = $state<string | null>(null);

  const hasPendingChanges = $derived.by(() => {
    const targetProgram = pendingProgram ?? currentTemplate().studiengang;
    const targetModel = pendingModel ?? currentTemplate().modell;
    const targetPlan = pendingPlan ?? selectedPlan();

    return (
      targetProgram !== currentTemplate().studiengang ||
      targetModel !== currentTemplate().modell ||
      targetPlan !== selectedPlan()
    );
  });

  const isPlanCustomized = $derived.by(() => courseStore.isStudyPlanCustomized());
  const targetTemplate = $derived.by(() => resolveTargetTemplate());

  const canLoadTemplate = $derived.by(() => {
    if (!targetTemplate) return false;
    return hasPendingChanges || isPlanCustomized;
  });

  const programOptions = $derived.by(() =>
    PROGRAMS.map((program) => {
      const availablePlanCount = (PROGRAM_PLANS[program.shortName] ?? []).length;
      return {
        value: program.shortName,
        label: program.name,
        disabled: availablePlanCount === 0,
        tooltip: availablePlanCount === 0 ? "Coming soon" : undefined,
      };
    })
  );

  const modelOptions = $derived.by(() => {
    const program = pendingProgram ?? currentTemplate().studiengang;
    const availableModels = getAvailableModels(program);
    const candidates: string[] = [...MODEL_ORDER];

    availableModels.forEach((model) => {
      if (!candidates.includes(model)) {
        candidates.push(model);
      }
    });

    return candidates.map((value) => {
      const isAvailable = availableModels.includes(value as StudyModel);
      const label = MODEL_LABELS[value as keyof typeof MODEL_LABELS] ?? value;
      return {
        value,
        label,
        disabled: !isAvailable,
        tooltip: !isAvailable ? "Coming soon" : undefined,
      };
    });
  });

  const planOptions = $derived.by(() => {
    const program = pendingProgram ?? currentTemplate().studiengang;
    const model = pendingModel ?? currentTemplate().modell;
    const actualPlans = model ? getAvailablePlans(program, model) : [];
    const declaredPlans = PROGRAM_PLANS[program] ?? [];
    const currentSelection = pendingPlan ?? selectedPlan();
    const combined: string[] = [...actualPlans];

    declaredPlans.forEach((plan) => {
      if (!combined.includes(plan)) {
        combined.push(plan);
      }
    });

    if (currentSelection && !combined.includes(currentSelection)) {
      combined.push(currentSelection);
    }

    return [...combined]
      .sort()
      .map((plan) => ({
        value: plan,
        label: plan,
        disabled: !actualPlans.includes(plan),
        tooltip: !actualPlans.includes(plan) ? "Coming soon" : undefined,
      }));
  });

  function syncPendingPlan(program: string, model: StudyModel | null) {
    if (!model) {
      pendingPlan = null;
      return;
    }

    const plans = getAvailablePlans(program, model);
    if (!plans.length) {
      pendingPlan = null;
      return;
    }

    const current = pendingPlan ?? selectedPlan();
    pendingPlan = plans.includes(current) ? current : plans[0];
  }

  function clearPendingSelections() {
    pendingProgram = null;
    pendingModel = null;
    pendingPlan = null;
  }

  function handleProgramChange(value: string) {
    pendingProgram = value;
    const models = getAvailableModels(value);
    if (!models.length) {
      pendingModel = null;
      pendingPlan = null;
      return;
    }

    const currentModel = pendingModel ?? currentTemplate().modell;
    pendingModel = models.includes(currentModel) ? currentModel : models[0];
    syncPendingPlan(value, pendingModel);
  }

  function handleModelChange(value: string) {
    const program = pendingProgram ?? currentTemplate().studiengang;
    pendingModel = value as StudyModel;
    syncPendingPlan(program, pendingModel);
  }

  function handlePlanChange(value: string) {
    pendingPlan = value;
  }

  function resolveTargetTemplate() {
    const program = pendingProgram ?? currentTemplate().studiengang;
    const model = pendingModel ?? currentTemplate().modell;
    const candidates = getAvailablePlans(program, model);
    const desiredPlan = pendingPlan ?? selectedPlan();
    const plan = candidates.includes(desiredPlan) ? desiredPlan : candidates[0];
    if (!plan) return undefined;

    return getTemplatesByProgram(program, model).find((template) => template.plan === plan);
  }

  function handleLoadClick() {
    if (!targetTemplate) {
      return;
    }

    if (!hasPendingChanges && !isPlanCustomized) {
      return;
    }

    if (isPlanCustomized) {
      showWarningDialog = true;
      return;
    }

    courseStore.switchTemplate(targetTemplate.id, true);
    clearPendingSelections();
  }

  function confirmTemplateSwitch() {
    const targetTemplate = resolveTargetTemplate();
    if (!targetTemplate) return;

    courseStore.switchTemplate(targetTemplate.id, true);
    showWarningDialog = false;
    clearPendingSelections();
  }

  function cancelTemplateSwitch() {
    showWarningDialog = false;
  }
</script>

<div class="space-y-3">
  <div class="space-y-1.5">
    <label for="program-select" class="text-xs font-medium text-text-secondary"
      >Program</label
    >
    <Dropdown
      options={programOptions}
      selected={pendingProgram ?? currentTemplate().studiengang}
      onSelect={handleProgramChange}
      minWidth="100%"
    />
  </div>

  <div class="space-y-1.5">
    <label for="model-select" class="text-xs font-medium text-text-secondary"
      >Study Model</label
    >
    <Dropdown
      options={modelOptions}
      selected={pendingModel ?? currentTemplate().modell}
      onSelect={handleModelChange}
      minWidth="100%"
    />
  </div>

  <div class="space-y-1.5">
    <label for="plan-select" class="text-xs font-medium text-text-secondary"
      >Plan</label
    >
    <Dropdown
      options={planOptions}
      selected={pendingPlan ?? selectedPlan()}
      onSelect={handlePlanChange}
      minWidth="100%"
    />
  </div>

  <button
    onclick={handleLoadClick}
    disabled={!canLoadTemplate}
    class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors {canLoadTemplate
      ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
      : 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500'}"
  >
    <div class="i-lucide-download"></div>
    Load Template
  </button>
</div>

{#if showWarningDialog}
  <ConfirmationDialog
    title="Load New Template?"
    message="Your customized study plan will be overwritten. Any custom nodes you've added or courses you've removed will be lost."
    confirmText="Load Template"
    cancelText="Cancel"
    variant="warning"
    onConfirm={confirmTemplateSwitch}
    onCancel={cancelTemplateSwitch}
  />
{/if}
