<script lang="ts">
  import type { IdmsPrerequisiteRule } from '$lib/types';
  import { COURSES } from '$lib/data/courses';
  import { progressStore } from '$lib/stores/progressStore.svelte';
  import { evaluatePrerequisiteRule } from '$lib/utils/prerequisite';

  let { prerequisites }: { prerequisites: IdmsPrerequisiteRule[] } = $props();

  const attended = $derived(progressStore.attendedSet);
  const completed = $derived(progressStore.completedSet);

  function renderPrerequisiteRule(rule: IdmsPrerequisiteRule) {
    const ruleMet = evaluatePrerequisiteRule(rule, attended, completed);
    
    return {
      rule,
      met: ruleMet
    };
  }
</script>

{#if prerequisites && prerequisites.length > 0}
  <div class="border-t border-border-primary pt-4">
    <h3 class="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
      <div class="i-lucide-git-branch text-text-secondary"></div>
      Prerequisites
    </h3>
    <ul class="space-y-1.5">
      {#each prerequisites as rule}
        {@const ruleData = renderPrerequisiteRule(rule)}
        
        <li class="flex items-start gap-2 text-sm">
          <div class="{ruleData.met ? 'i-lucide-check text-green-500' : 'i-lucide-circle text-gray-400'} mt-0.5"></div>
          <div class="flex-1">
            <div class={ruleData.met ? 'text-text-primary' : 'text-text-secondary'}>
              <span class="font-semibold">{rule.mustBePassed ? "Completed" : "Attended"}</span>
              <span class="ml-1">{rule.moduleLinkType === 'oder' ? "one of:" : "all of:"}</span>
              <div class="ml-2 mt-1 space-y-1">
                {#each rule.modules as moduleId}
                  {@const course = COURSES.find(c => c.id === moduleId)}
                  {@const moduleMet = rule.mustBePassed ? completed.has(moduleId) : (attended.has(moduleId) || completed.has(moduleId))}
                  <div class="flex items-center gap-1.5 text-xs">
                    <div class="{moduleMet ? 'i-lucide-check text-green-500' : 'i-lucide-minus text-gray-400'} text-xs"></div>
                    <span class={moduleMet ? 'text-text-primary' : 'text-text-secondary'}>
                      {course?.label || moduleId}
                    </span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  </div>
{:else}
  <div class="border-t border-border-primary pt-4">
    <h3 class="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
      <div class="i-lucide-git-branch text-text-secondary"></div>
      Prerequisites
    </h3>
    <p class="text-sm text-text-secondary">None</p>
  </div>
{/if}
