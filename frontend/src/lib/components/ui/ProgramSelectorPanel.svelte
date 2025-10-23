<script lang="ts">
  import { uiStore } from '$lib/stores/uiStore.svelte';
  import TemplateSelector from '$lib/components/header/TemplateSelector.svelte';
  
  const showProgramSelector = $derived(uiStore.showProgramSelector);
</script>

{#if showProgramSelector}
  <div class="border-b border-border-primary bg-bg-secondary px-6 py-4">
    <div class="max-w-4xl mx-auto">
      <h2 class="text-lg font-bold text-text-primary mb-3">Program Selection</h2>
      <div class="flex items-center gap-6">
        <TemplateSelector />
      </div>
    </div>
  </div>
{/if}
