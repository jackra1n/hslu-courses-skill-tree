<script lang="ts">
  import { currentTemplate, selectedPlan, availablePlans, courseStore } from '$lib/stores/courseStore.svelte';
  import { AVAILABLE_TEMPLATES, getTemplatesByProgram } from '$lib/data/courses';
  import { PROGRAMS, PROGRAM_PLANS } from '$lib/data/programs';
  import Dropdown from '$lib/components/ui/Dropdown.svelte';

  const programOptions = PROGRAMS.map((p) => ({
    value: p,
    label: p,
    disabled: p !== 'Informatik',
    tooltip: p !== 'Informatik' ? 'Coming soon' : undefined,
  }));

  const modelOptions = [
    { value: 'fulltime', label: 'Fulltime' },
    {
      value: 'parttime',
      label: 'Parttime',
      disabled: true,
      tooltip: 'Coming soon',
    },
    {
      value: 'berufsbegleitend',
      label: 'Berufsbegleitend',
      disabled: true,
      tooltip: 'Coming soon',
    },
  ];

  const planOptions = $derived.by(() => {
    const declaredPlans = PROGRAM_PLANS[currentTemplate().studiengang] || [];
    const plansUnion = Array.from(new Set([...availablePlans(), ...declaredPlans])).sort();
    return plansUnion.map((plan) => ({
      value: plan,
      label: plan,
      disabled: !availablePlans().includes(plan),
      tooltip: !availablePlans().includes(plan) ? 'Coming soon' : undefined,
    }));
  });

  function handleProgramChange(value: string) {
    const template = AVAILABLE_TEMPLATES.find((t) => t.studiengang === value && t.modell === currentTemplate().modell);
    if (template) courseStore.switchTemplate(template.id);
  }

  function handleModelChange(value: string) {
    const modell = value as 'fulltime' | 'parttime' | 'berufsbegleitend';
    const template =
      getTemplatesByProgram(currentTemplate().studiengang, modell as 'fulltime' | 'parttime').find(
        (t) => t.plan === selectedPlan(),
      ) || getTemplatesByProgram(currentTemplate().studiengang, modell as 'fulltime' | 'parttime')[0];
    if (template) courseStore.switchTemplate(template.id);
  }

  function handlePlanChange(value: string) {
    courseStore.switchPlan(value);
  }
</script>

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
</div>
