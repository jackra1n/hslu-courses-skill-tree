<script lang="ts">
  import Header from '$lib/components/header/Header.svelte';
  import AssessmentInfo from '$lib/components/ui/AssessmentInfo.svelte';
  import HowToUseModal from '$lib/components/ui/HowToUseModal.svelte';
  import SkillTreeCanvas from '$lib/components/canvas/SkillTreeCanvas.svelte';
  import CourseDetailsPanel from '$lib/components/sidebar/CourseDetailsPanel.svelte';
  import StatusLegend from '$lib/components/sidebar/StatusLegend.svelte';
  import { hasSelection } from '$lib/stores/uiStore.svelte';

  let legendOpen = $state(false);

  $effect(() => {
    if (hasSelection()) {
      legendOpen = false;
    }
  });
</script>

<div class="font-sans h-screen flex flex-col">
  <Header />
  
  <div class="flex-1 min-h-0 lg:grid lg:grid-cols-[1fr_400px]">
    <SkillTreeCanvas />
    <CourseDetailsPanel />
  </div>
  
  <!-- assessment info modal -->
  <AssessmentInfo />
  <HowToUseModal />

  <div class="lg:hidden fixed bottom-4 right-4 z-30 w-72 max-w-[90vw]">
    <div class={`rounded-2xl border border-border-primary bg-bg-primary shadow-2xl backdrop-blur transition-all duration-300 overflow-hidden flex flex-col-reverse ${legendOpen ? 'max-h-96' : 'max-h-14'}`}>
      <button
        type="button"
        class="flex w-full items-center justify-between gap-2 px-4 py-3 text-text-primary"
        aria-label="Toggle status legend"
        aria-pressed={legendOpen}
        onclick={() => legendOpen = !legendOpen}
      >
        <div class="flex items-center gap-2">
          <div class="i-lucide-info w-4 h-4"></div>
          <span class="text-sm font-medium">Legend</span>
        </div>
        {#if legendOpen}
          <div class="i-lucide-chevron-down h-4 w-4 text-text-secondary"></div>
        {:else}
          <div class="i-lucide-chevron-up h-4 w-4 text-text-secondary"></div>
        {/if}
      </button>
      {#if legendOpen}
        <div class="px-4 pb-4 pt-3 border-b border-border-primary">
          <div class="[&>div:first-child]:border-t-0 [&>div:first-child]:pt-0">
            <StatusLegend />
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
