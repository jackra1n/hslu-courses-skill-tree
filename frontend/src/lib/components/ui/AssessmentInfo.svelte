<script lang="ts">
  import { showAssessmentInfo, uiStore } from '$lib/stores/uiStore.svelte';
  import { fade, scale } from 'svelte/transition';
  
  function closeModal() {
    uiStore.toggleAssessmentInfo();
  }
</script>

{#if showAssessmentInfo()}
  <!-- modal backdrop -->
  <div 
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    transition:fade={{ duration: 200 }}
    onclick={closeModal}
    onkeydown={(e) => e.key === 'Enter' && closeModal()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="-1"
  >
    <!-- modal content -->
    <div 
      class="bg-bg-primary border border-border-primary rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      transition:scale={{ duration: 200, start: 0.95 }}
      role="document"
    >
      <div onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="button" tabindex="-1">
      <!-- modal header -->
      <div class="flex items-center justify-between p-6 border-b border-border-primary">
        <h2 id="modal-title" class="text-xl font-bold text-text-primary">Assessment Stage Rules</h2>
        <button 
          onclick={closeModal}
          class="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-bg-secondary transition-colors text-text-primary"
          aria-label="Close modal"
        >
          <div class="i-lucide-x h-4 w-4"></div>
        </button>
      </div>
      
      <!-- modal body -->
      <div class="p-6">
        <div class="space-y-6 text-sm text-text-secondary">
          <div>
            <h3 class="font-semibold text-text-primary mb-3">Passing Requirements:</h3>
            <ul class="space-y-2 ml-4">
              <li><strong>Definitiv bestanden:</strong> 54 credits achieved</li>
              <li><strong>Bedingt bestanden:</strong> ≥42 credits with ≥6 credits from project modules</li>
              <li><strong>Nicht bestanden:</strong> &lt;42 credits or &lt;6 credits from project modules</li>
            </ul>
          </div>
          <div>
            <h3 class="font-semibold text-text-primary mb-3">Consequences:</h3>
            <ul class="space-y-2 ml-4">
              <li><strong>Bedingt bestanden:</strong> Can continue studying, but must earn remaining credits within 5 semesters</li>
              <li><strong>Nicht bestanden:</strong> Cannot continue to intermediate stage</li>
              <li>Students who don't pass definitively within 5 semesters are excluded from the bachelor program</li>
            </ul>
          </div>
          <div class="bg-bg-secondary p-4 rounded-lg border border-border-primary">
            <p class="text-xs text-text-tertiary">
              <strong>Note:</strong> In this skill tree, assessment stage requirements are considered met when you have completed 6+ courses. This is an approximation for demonstration purposes.
            </p>
          </div>
        </div>
      </div>
      
      <!-- modal footer -->
      <div class="flex justify-end p-6 border-t border-border-primary">
        <button 
          onclick={closeModal}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Got it
        </button>
      </div>
      </div>
    </div>
  </div>
{/if}
