<script lang="ts">
  import { uiStore } from '$lib/stores/uiStore.svelte';
  
  const showAssessmentInfo = $derived(uiStore.showAssessmentInfo);
</script>

{#if showAssessmentInfo}
  <div class="border-b border-border-primary bg-bg-secondary px-6 py-4">
    <div class="max-w-4xl mx-auto">
      <h2 class="text-lg font-bold text-text-primary mb-3">Assessment Stage Rules</h2>
      <div class="space-y-4 text-sm text-text-secondary">
        <div>
          <h3 class="font-semibold text-text-primary mb-2">Passing Requirements:</h3>
          <ul class="space-y-1 ml-4">
            <li><strong>Definitiv bestanden:</strong> 54 credits achieved</li>
            <li><strong>Bedingt bestanden:</strong> ≥42 credits with ≥6 credits from project modules</li>
            <li><strong>Nicht bestanden:</strong> &lt;42 credits or &lt;6 credits from project modules</li>
          </ul>
        </div>
        <div>
          <h3 class="font-semibold text-text-primary mb-2">Consequences:</h3>
          <ul class="space-y-1 ml-4">
            <li><strong>Bedingt bestanden:</strong> Can continue studying, but must earn remaining credits within 5 semesters</li>
            <li><strong>Nicht bestanden:</strong> Cannot continue to intermediate stage</li>
            <li>Students who don't pass definitively within 5 semesters are excluded from the bachelor program</li>
          </ul>
        </div>
        <div class="text-xs text-text-tertiary">
          <p><strong>Note:</strong> In this skill tree, "assessmentstufe bestanden" is considered met when you have completed 6+ courses. This is an approximation for demonstration purposes.</p>
        </div>
      </div>
    </div>
  </div>
{/if}
