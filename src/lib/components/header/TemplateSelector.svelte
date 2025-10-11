<script lang="ts">
  import { courseStore } from '$lib/stores/courseStore.svelte';
  import { AVAILABLE_TEMPLATES, getTemplatesByProgram } from '$lib/data/courses';

  const currentTemplate = $derived(courseStore.currentTemplate);
  const selectedPlan = $derived(courseStore.selectedPlan);
  const availablePlans = $derived(courseStore.availablePlans);

  function handleProgramChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const studiengang = target.value;
    const template = AVAILABLE_TEMPLATES.find(t => 
      t.studiengang === studiengang && t.modell === currentTemplate.modell
    );
    if (template) courseStore.switchTemplate(template.id);
  }

  function handleModelChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const modell = target.value as "fulltime" | "parttime";
    const template = getTemplatesByProgram(currentTemplate.studiengang, modell)
      .find(t => t.plan === selectedPlan) || 
      getTemplatesByProgram(currentTemplate.studiengang, modell)[0];
    if (template) courseStore.switchTemplate(template.id);
  }

  function handlePlanChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const plan = target.value;
    courseStore.switchPlan(plan);
  }
</script>

<div class="flex items-center gap-3">
  <div class="flex items-center gap-2">
    <label for="program-select" class="text-sm font-medium text-text-primary">Program:</label>
    <select 
      id="program-select"
      value={currentTemplate.studiengang}
      onchange={handleProgramChange}
      class="px-3 py-1.5 rounded-lg text-sm border border-border-primary bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="Informatik">Informatik</option>
    </select>
  </div>
  
  <div class="flex items-center gap-2">
    <label for="model-select" class="text-sm font-medium text-text-primary">Model:</label>
    <select 
      id="model-select"
      value={currentTemplate.modell}
      onchange={handleModelChange}
      class="px-3 py-1.5 rounded-lg text-sm border border-border-primary bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="fulltime">Full-time</option>
      <option value="parttime">Part-time</option>
    </select>
  </div>
  
  <div class="flex items-center gap-2">
    <label for="plan-select" class="text-sm font-medium text-text-primary">Plan:</label>
    <select 
      id="plan-select"
      value={selectedPlan}
      onchange={handlePlanChange}
      class="px-3 py-1.5 rounded-lg text-sm border border-border-primary bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {#each availablePlans as plan}
        <option value={plan}>{plan}</option>
      {/each}
    </select>
  </div>
</div>
