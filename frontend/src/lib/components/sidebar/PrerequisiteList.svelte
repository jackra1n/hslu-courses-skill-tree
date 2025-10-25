<script lang="ts">
  import type { PrerequisiteRule } from '$lib/types';
  import { COURSES } from '$lib/data/courses';
  import { slotStatusMap } from '$lib/stores/progressStore.svelte';
  import { evaluatePrerequisiteRule } from '$lib/utils/prerequisite';
  import { uiStore } from '$lib/stores/uiStore.svelte';
  import { currentTemplate, userSelections } from '$lib/stores/courseStore.svelte';

  let {
    prerequisites,
    assessmentLevelPassed,
  }: {
    prerequisites: PrerequisiteRule[];
    assessmentLevelPassed?: boolean;
  } = $props();

  const completedCount = $derived(
    Array.from(slotStatusMap().values()).filter((status) => status === 'completed').length,
  );

  const assessmentStageMet = $derived(completedCount >= 6);

  function renderPrerequisiteRule(rule: PrerequisiteRule) {
    const ruleMet = evaluatePrerequisiteRule(rule, slotStatusMap(), currentTemplate(), userSelections());

    return {
      rule,
      met: ruleMet,
    };
  }

  function isModuleMet(moduleId: string, mustBePassed: boolean): boolean {
    const slotsWithCourse = currentTemplate().slots.filter((slot) => {
      if (slot.type === 'fixed') return slot.courseId === moduleId;
      if (slot.type === 'elective' || slot.type === 'major') return userSelections()[slot.id] === moduleId;
      return false;
    });

    return slotsWithCourse.some((slot) => {
      const status = slotStatusMap().get(slot.id);
      if (mustBePassed) {
        return status === 'completed';
      } else {
        return status === 'attended' || status === 'completed';
      }
    });
  }

  function openAssessmentInfo() {
    uiStore.toggleAssessmentInfo();
  }
</script>

{#if prerequisites && prerequisites.length > 0}
  <div class="border-t border-border-primary pt-4">
    <h3
      class="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2"
    >
      <div class="i-lucide-git-branch text-text-secondary"></div>
      Prerequisites
    </h3>

    {#if assessmentLevelPassed}
      <div class="mb-3 flex items-start gap-2 text-sm">
        <div
          class="{assessmentStageMet
            ? 'i-lucide-check text-green-500'
            : 'i-lucide-circle text-gray-400'} mt-0.5"
        ></div>
        <div class="flex-1">
          <div
            class={assessmentStageMet
              ? "text-text-primary"
              : "text-text-secondary"}
          >
            <div class="flex items-center gap-1">
              <span class="font-semibold">Assessment Stage Passed</span>
              <button
                onclick={openAssessmentInfo}
                class="text-blue-500 hover:text-blue-600 transition-colors inline-flex items-center"
                aria-label="Learn more about assessment stage"
              >
                <div class="i-lucide-info text-xs"></div>
              </button>
            </div>
            <div class="text-xs opacity-60 mt-0.5">
              {completedCount}/6+ courses completed
            </div>
          </div>
        </div>
      </div>
    {/if}

    <ul class="space-y-1.5">
      {#each prerequisites as rule, index}
        {@const ruleData = renderPrerequisiteRule(rule)}
        {@const prevRule = index > 0 ? prerequisites[index - 1] : null}
        {@const showOrSeparator =
          prevRule && prevRule.prerequisiteLinkType === "oder"}

        {#if showOrSeparator}
          <li class="flex items-center justify-center py-1">
            <div
              class="text-xs font-medium text-text-secondary bg-bg-primary px-2 py-1 rounded-full border border-border-primary"
            >
              OR
            </div>
          </li>
        {/if}

        <li class="flex items-start gap-2 text-sm">
          <div
            class="{ruleData.met
              ? 'i-lucide-check text-green-500'
              : 'i-lucide-circle text-gray-400'} mt-0.5"
          ></div>
          <div class="flex-1">
            <div
              class={ruleData.met ? "text-text-primary" : "text-text-secondary"}
            >
              <span class="font-semibold"
                >{rule.mustBePassed ? "Completed" : "Attended"}</span
              >
              <span class="ml-1"
                >{rule.moduleLinkType === "oder" ? "one of:" : "all of:"}</span
              >
              <div class="ml-2 mt-1 space-y-1">
                {#each rule.modules as moduleId}
                  {@const course = COURSES.find((c) => c.id === moduleId)}
                  {@const moduleMet = isModuleMet(moduleId, rule.mustBePassed)}
                  <div class="flex items-center gap-1.5 text-xs">
                    <div
                      class="{moduleMet
                        ? 'i-lucide-check text-green-500'
                        : 'i-lucide-minus text-gray-400'} text-xs"
                    ></div>
                    <span
                      class={moduleMet
                        ? "text-text-primary"
                        : "text-text-secondary"}
                    >
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
    <h3
      class="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2"
    >
      <div class="i-lucide-git-branch text-text-secondary"></div>
      Prerequisites
    </h3>

    {#if assessmentLevelPassed}
      <div class="mb-3 flex items-start gap-2 text-sm">
        <div
          class="{assessmentStageMet
            ? 'i-lucide-check text-green-500'
            : 'i-lucide-circle text-gray-400'} mt-0.5"
        ></div>
        <div class="flex-1">
          <div
            class={assessmentStageMet
              ? "text-text-primary"
              : "text-text-secondary"}
          >
            <div class="flex items-center gap-1">
              <span class="font-semibold">Assessment Stage Passed</span>
              <button
                onclick={openAssessmentInfo}
                class="text-blue-500 hover:text-blue-600 ml-1 transition-colors inline-flex items-center"
                aria-label="Learn more about assessment stage"
              >
                <div class="i-lucide-info text-xs"></div>
              </button>
            </div>
            <div class="text-xs opacity-60 mt-0.5">
              {completedCount}/6+ courses completed
            </div>
          </div>
        </div>
      </div>
      <p class="text-sm text-text-secondary">No other prerequisites</p>
    {:else}
      <p class="text-sm text-text-secondary">None</p>
    {/if}
  </div>
{/if}
