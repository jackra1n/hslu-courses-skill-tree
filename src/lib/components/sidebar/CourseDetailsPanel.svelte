<script lang="ts">
  import {
    getSelection,
    getHasSelection,
    getIsElectiveSlot,
    uiStore
  } from '$lib/stores/uiStore.svelte';
  import {
    getCurrentTemplate,
    getUserSelections
  } from '$lib/stores/courseStore.svelte';
  import { COURSES } from '$lib/data/courses';
  import ElectiveCourseSelector from './ElectiveCourseSelector.svelte';
  import PrerequisiteList from './PrerequisiteList.svelte';
  import ActionButtons from './ActionButtons.svelte';
  import StatusLegend from './StatusLegend.svelte';
  import PrerequisiteWarning from '$lib/components/ui/PrerequisiteWarning.svelte';
  import { hasPrereqAfter } from '$lib/utils/prerequisite';
  import { TemplateIndex } from '$lib/utils/template-index';

  const selection = $derived(getSelection());
  const hasSelection = $derived(getHasSelection());
  const isElectiveSlot = $derived(getIsElectiveSlot());
  const currentTemplate = $derived(getCurrentTemplate());
  const userSelections = $derived(getUserSelections());

  const displayCourse = $derived.by(() => {
    if (!selection) return null;
    
    if (isElectiveSlot) {
      const selectedCourseId = userSelections[selection.id];
      if (selectedCourseId) {
        return COURSES.find(c => c.id === selectedCourseId) || selection;
      }
    }
    
    return selection;
  });

  const hasLaterPrerequisites = $derived.by(() => {
    if (!displayCourse || isElectiveSlot) return false;
    
    const slot = currentTemplate.slots.find(s => s.courseId === displayCourse.id);
    if (!slot) return false;
    
    const index = new TemplateIndex(currentTemplate, userSelections);
    return hasPrereqAfter(slot, displayCourse, index, { considerSameSemester: true });
  });
</script>

<aside class="border-l border-border-primary bg-bg-secondary overflow-y-auto">
  {#if hasSelection}
    <div class="p-6 space-y-6">
      <div>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-xl font-bold text-text-primary">{displayCourse?.label || ''}</h2>
          <button 
            onclick={() => uiStore.deselectCourse()}
            class="flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-all"
            title="Deselect course"
          >
            <div class="i-lucide-x w-4 h-4"></div>
          </button>
        </div>
        
        <div class="flex items-center gap-4 text-sm text-text-secondary mb-2">
          <div class="flex items-center gap-1.5">
            <div class="i-lucide-book-open text-text-secondary"></div>
                   <span>{displayCourse?.ects || 0} ECTS</span>
          </div>
          <div class="flex items-center gap-1.5">
            <div class="i-lucide-calendar text-text-secondary"></div>
            <span>Semester {isElectiveSlot ? (currentTemplate.slots.find(s => s.id === selection?.id)?.semester || '?') : (currentTemplate.slots.find(s => s.courseId === selection?.id)?.semester || '?')}</span>
          </div>
        </div>
        
        {#if displayCourse?.type}
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-purple-100 rounded-md text-sm font-medium">
            <div class="i-lucide-layers text-purple-600 dark:text-purple-400"></div>
            {displayCourse.type}
          </div>
        {/if}
      </div>

      {#if isElectiveSlot}
        <ElectiveCourseSelector slotId={selection?.id || ''} />
      {:else}
        {#if hasLaterPrerequisites}
          <PrerequisiteWarning />
        {/if}
        <PrerequisiteList prerequisites={displayCourse?.prerequisites || []} />
        <ActionButtons courseId={displayCourse?.id || ''} />
      {/if}
    </div>
  {:else}
    <div class="p-6 space-y-6">
      <div class="text-center py-8">
        <div class="i-lucide-mouse-pointer-click w-12 h-12 mx-auto text-text-secondary mb-3"></div>
        <p class="text-sm text-text-secondary">
          Click on a course to view details and track your progress
        </p>
        <p class="text-xs text-text-tertiary mt-2">
          Click on dashed "Wahl-Modul" nodes to select courses
        </p>
      </div>
      
      <StatusLegend />
    </div>
  {/if}
</aside>
