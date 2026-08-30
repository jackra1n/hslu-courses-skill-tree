<script lang="ts">
import { fade, scale } from 'svelte/transition';
import * as m from '$lib/paraglide/messages';
import { showAssessmentInfo, uiStore } from '$lib/stores/uiStore.svelte';

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
        <h2 id="modal-title" class="text-xl font-bold text-text-primary">{m.assessment_title()}</h2>
        <button 
          onclick={closeModal}
          class="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-bg-secondary transition-colors text-text-primary"
          aria-label={m.assessment_close()}
        >
          <div class="i-lucide-x h-4 w-4"></div>
        </button>
      </div>
      
      <!-- modal body -->
      <div class="p-6">
        <div class="space-y-6 text-sm text-text-secondary">
          <div>
            <h3 class="font-semibold text-text-primary mb-3">{m.assessment_passing()}</h3>
            <ul class="space-y-2 ml-4">
              <li><strong>Definitiv bestanden:</strong> {m.assessment_definitiv()}</li>
              <li><strong>Bedingt bestanden:</strong> {m.assessment_bedingt()}</li>
              <li><strong>Nicht bestanden:</strong> {m.assessment_nicht()}</li>
            </ul>
          </div>
          <div>
            <h3 class="font-semibold text-text-primary mb-3">{m.assessment_consequences()}</h3>
            <ul class="space-y-2 ml-4">
              <li><strong>Bedingt bestanden:</strong> {m.assessment_consequences_bedingt()}</li>
              <li><strong>Nicht bestanden:</strong> {m.assessment_consequences_nicht()}</li>
              <li>{m.assessment_consequences_excluded()}</li>
            </ul>
          </div>
        </div>
      </div>
      
      <!-- modal footer -->
      <div class="flex justify-end p-6 border-t border-border-primary">
        <button 
          onclick={closeModal}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          {m.common_got_it()}
        </button>
      </div>
      </div>
    </div>
  </div>
{/if}
