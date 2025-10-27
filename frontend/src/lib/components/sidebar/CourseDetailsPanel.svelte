<script lang="ts">
  import {
    selection,
    hasSelection,
    isElectiveSlot,
    uiStore
  } from '$lib/stores/uiStore.svelte';
  import {
    studyPlan,
    userSelections
  } from '$lib/stores/courseStore.svelte';
  import { getCourseById } from '$lib/data/courses';
  import ElectiveCourseSelector from './ElectiveCourseSelector.svelte';
  import PrerequisiteList from './PrerequisiteList.svelte';
  import ActionButtons from './ActionButtons.svelte';
  import StatusLegend from './StatusLegend.svelte';
  import PrerequisiteWarning from '$lib/components/ui/PrerequisiteWarning.svelte';
  import { hasPlanPrereqConflict } from '$lib/utils/prerequisite';
  import { hasMissingPrerequisites, hasAssessmentStageViolation } from '$lib/utils/status';

  const displayCourse = $derived.by(() => {
    if (!selection()) return null;
    
    if (isElectiveSlot()) {
      const selectedCourseId = userSelections()[selection()!.id];
      if (selectedCourseId) {
        const selectedCourse = getCourseById(selectedCourseId);
        if (selectedCourse) {
          return selectedCourse;
        }
        return selection();
      }
    }
    
    return selection();
  });

  const activePlanNode = $derived.by(() => {
    if (!selection()) return null;
    const plan = studyPlan();
    const slotMatch = plan.nodes[selection()!.id];
    if (slotMatch) return slotMatch;
    return Object.values(plan.nodes).find((node) => node.courseId === selection()!.id) ?? null;
  });

  const warningType = $derived.by(() => {
    if (!displayCourse || !activePlanNode) return null;
    
    const plan = studyPlan();

    if (hasPlanPrereqConflict(plan, activePlanNode.id, { considerSameSemester: false })) {
      return 'later-prerequisites';
    }

    if (hasMissingPrerequisites(plan, activePlanNode.id)) {
      return 'missing-prerequisites';
    }

    if (hasAssessmentStageViolation(plan, activePlanNode.id)) {
      return 'assessment-stage';
    }
    
    return null;
  });

  const isDrawerOpen = $derived(hasSelection());
</script>

<!-- mobile backdrop -->
<div
  class={`fixed inset-0 z-30 bg-black/40 transition-opacity duration-200 lg:hidden ${isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
  aria-hidden={!isDrawerOpen}
  onclick={() => uiStore.deselectCourse()}
></div>

<aside
  class={`bg-bg-secondary overflow-y-auto border border-border-primary transition-transform duration-300 ease-out
    fixed top-[60px] sm:top-[72px] bottom-0 right-0 z-40 w-full max-w-md shadow-2xl
    ${isDrawerOpen ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'}
    lg:static lg:top-auto lg:bottom-auto lg:right-auto lg:max-w-none lg:w-full lg:border-y-0 lg:border-r-0 lg:border-l lg:translate-x-0 lg:shadow-none lg:pointer-events-auto`}
>
  {#if hasSelection()}
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
            <span>Semester {activePlanNode?.semester ?? '?'}</span>
          </div>
        </div>
        
        {#if displayCourse?.type}
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-purple-100 rounded-md text-sm font-medium">
            <div class="i-lucide-layers text-purple-600 dark:text-purple-400"></div>
            {displayCourse.type}
          </div>
        {/if}
      </div>

      {#if isElectiveSlot()}
        <ElectiveCourseSelector slotId={selection()?.id || ''} />
      {:else}
        {#if warningType}
          <PrerequisiteWarning type={warningType} />
        {/if}
        <PrerequisiteList prerequisites={displayCourse?.prerequisites || []} assessmentLevelPassed={displayCourse?.assessmentLevelPassed} />
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
      
      <div class="hidden lg:block">
        <StatusLegend />
      </div>
    </div>
  {/if}
</aside>
