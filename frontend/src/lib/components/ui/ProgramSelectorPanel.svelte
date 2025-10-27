<script lang="ts">
  import { showProgramSelector } from '$lib/stores/uiStore.svelte';
  import {
    currentTemplate,
    selectedPlan,
    availablePlans,
    courseStore,
  } from "$lib/stores/courseStore.svelte";
  import {
    AVAILABLE_TEMPLATES,
    getTemplatesByProgram,
  } from "$lib/data/courses";
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

  let pendingTemplateId = $state<string | null>(null);
  let showLoadButton = $state(false);
  let showWarningDialog = $state(false);

  function handleProgramChange(value: string) {
    const template = AVAILABLE_TEMPLATES.find(
      (t) => t.studiengang === value && t.modell === currentTemplate().modell
    );
    if (template && template.id !== currentTemplate().id) {
      pendingTemplateId = template.id;
      showLoadButton = true;
    }
  }

  function handleModelChange(value: string) {
    const modell = value as "fulltime" | "parttime" | "berufsbegleitend";
    const template =
      getTemplatesByProgram(
        currentTemplate().studiengang,
        modell as "fulltime" | "parttime"
      ).find((t) => t.plan === selectedPlan()) ||
      getTemplatesByProgram(
        currentTemplate().studiengang,
        modell as "fulltime" | "parttime"
      )[0];
    if (template && template.id !== currentTemplate().id) {
      pendingTemplateId = template.id;
      showLoadButton = true;
    }
  }

  function handlePlanChange(value: string) {
    // Plan changes don't require confirmation, they just switch within the same template
    courseStore.switchPlan(value);
  }

  function handleLoadClick() {
    if (!pendingTemplateId) return;
    
    if (courseStore.isStudyPlanCustomized()) {
      showWarningDialog = true;
    } else {
      confirmTemplateSwitch();
    }
  }

  function confirmTemplateSwitch() {
    if (pendingTemplateId) {
      courseStore.switchTemplate(pendingTemplateId);
      pendingTemplateId = null;
      showLoadButton = false;
      showWarningDialog = false;
    }
  }

  function cancelTemplateSwitch() {
    pendingTemplateId = null;
    showLoadButton = false;
    showWarningDialog = false;
  }
</script>

{#if showProgramSelector()}
  <div class="border-b border-border-primary bg-bg-secondary px-6 py-4">
    <div class="max-w-4xl mx-auto">
      <h2 class="text-lg font-bold text-text-primary mb-3">Program Selection</h2>
      <div class="space-y-3">
        <div class="space-y-1.5">
          <label for="program-select" class="text-xs font-medium text-text-secondary"
            >Program</label
          >
          <Dropdown
            options={programOptions}
            selected={currentTemplate().studiengang}
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
            selected={currentTemplate().modell}
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

        {#if showLoadButton}
          <button
            onclick={handleLoadClick}
            class="w-full px-4 py-2 bg-accent-primary text-white rounded-md hover:bg-accent-primary/90 transition-colors font-medium"
          >
            Load Template
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

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
