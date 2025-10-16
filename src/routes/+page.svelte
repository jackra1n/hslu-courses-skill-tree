<script lang="ts">
  import Header from '$lib/components/header/Header.svelte';
  import AssessmentInfo from '$lib/components/ui/AssessmentInfo.svelte';
  import SkillTreeCanvas from '$lib/components/canvas/SkillTreeCanvas.svelte';
  import CourseDetailsPanel from '$lib/components/sidebar/CourseDetailsPanel.svelte';
  import { getShowAssessmentInfo } from '$lib/stores/uiStore.svelte';

const showAssessmentInfo = $derived(getShowAssessmentInfo());
</script>

<div class="font-sans h-screen flex flex-col">
  <Header />
  {#if showAssessmentInfo}
    <AssessmentInfo />
  {/if}
  
  <div class="flex-1 grid grid-cols-[1fr_400px] min-h-0">
    <SkillTreeCanvas />
    <CourseDetailsPanel />
  </div>
</div>

