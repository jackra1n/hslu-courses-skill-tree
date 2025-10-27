<script lang="ts">
  import {
    currentTemplate,
    selectedPlan,
    availablePlans,
    courseStore,
  } from "$lib/stores/courseStore.svelte";
  import { AVAILABLE_TEMPLATES } from "$lib/data/courses";
  import { PROGRAMS, PROGRAM_PLANS } from "$lib/data/programs";
  import Dropdown from "$lib/components/ui/Dropdown.svelte";
  import ConfirmationDialog from "$lib/components/ui/ConfirmationDialog.svelte";

  const programOptions = PROGRAMS.map((p) => ({
    value: p,
    label: p,
    disabled: p !== "Informatik",
    tooltip: p !== "Informatik" ? "Coming soon" : undefined,
  }));

  const modelOptions = [
    { value: "fulltime", label: "Fulltime" },
    {
      value: "parttime",
      label: "Parttime",
      disabled: true,
      tooltip: "Coming soon",
    },
    {
      value: "berufsbegleitend",
      label: "Berufsbegleitend",
      disabled: true,
      tooltip: "Coming soon",
    },
  ];

  const planOptions = $derived.by(() => {
    const declaredPlans = PROGRAM_PLANS[currentTemplate().studiengang] || [];
    const plansUnion = Array.from(
      new Set([...availablePlans(), ...declaredPlans])
    ).sort();
    return plansUnion.map((plan) => ({
      value: plan,
      label: plan,
      disabled: !availablePlans().includes(plan),
      tooltip: !availablePlans().includes(plan) ? "Coming soon" : undefined,
    }));
  });

  let showWarningDialog = $state(false);
  let pendingProgram = $state<string | null>(null);
  let pendingModel = $state<string | null>(null);

  function handleProgramChange(value: string) {
    pendingProgram = value;
  }

  function handleModelChange(value: string) {
    pendingModel = value;
  }

  function handlePlanChange(value: string) {
    courseStore.switchPlan(value);
  }

  function findTemplateForCurrentSelections() {
    const program = pendingProgram ?? currentTemplate().studiengang;
    const model = pendingModel ?? currentTemplate().modell;
    const plan = selectedPlan();

    return AVAILABLE_TEMPLATES.find(
      (t) =>
        t.studiengang === program &&
        t.modell === model &&
        t.plan === plan
    );
  }

  function handleLoadClick() {
    const targetTemplate = findTemplateForCurrentSelections();
    if (!targetTemplate) return;

    if (courseStore.isStudyPlanCustomized()) {
      showWarningDialog = true;
    } else {
      courseStore.switchTemplate(targetTemplate.id, true);
    }
  }

  function confirmTemplateSwitch() {
    const targetTemplate = findTemplateForCurrentSelections();
    
    if (targetTemplate) {
      courseStore.switchTemplate(targetTemplate.id, true);
      showWarningDialog = false;
      pendingProgram = null;
      pendingModel = null;
    }
  }

  function cancelTemplateSwitch() {
    showWarningDialog = false;
    pendingProgram = null;
    pendingModel = null;
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
      selected={selectedPlan()}
      onSelect={handlePlanChange}
      minWidth="100%"
    />
  </div>

  <button
    onclick={handleLoadClick}
    class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm dark:bg-blue-500 dark:hover:bg-blue-600"
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
