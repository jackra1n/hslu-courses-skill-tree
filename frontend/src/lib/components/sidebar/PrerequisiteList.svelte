<script lang="ts">
import { courseLabel } from '$lib/data/course-label';
import { getCourseById } from '$lib/data/courses';
import * as m from '$lib/paraglide/messages';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import { slotStatusMap } from '$lib/stores/progressStore.svelte';
import { uiStore } from '$lib/stores/uiStore.svelte';
import type { PrerequisiteRule } from '$lib/types';
import { evaluatePrerequisiteRule } from '$lib/utils/prerequisite';
import { getAssessmentStageProgress } from '$lib/utils/status';

const courseStore = getCourseStore();
let {
	prerequisites,
	assessmentLevelPassed,
	separated = true,
}: {
	prerequisites: PrerequisiteRule[];
	assessmentLevelPassed?: boolean;
	separated?: boolean;
} = $props();

const assessmentStageProgress = $derived(
	getAssessmentStageProgress(courseStore.studyPlan, slotStatusMap()),
);

function renderPrerequisiteRule(rule: PrerequisiteRule) {
	const ruleMet = evaluatePrerequisiteRule(
		rule,
		slotStatusMap(),
		courseStore.studyPlan,
	);

	return {
		rule,
		met: ruleMet,
	};
}

function isModuleMet(moduleId: string, mustBePassed: boolean): boolean {
	const nodes = Object.values(courseStore.studyPlan.nodes).filter(
		(node) => node.courseId === moduleId,
	);
	return nodes.some((node) => {
		const status = slotStatusMap().get(node.id);
		if (mustBePassed) {
			return status === 'completed';
		} else {
			return status === 'attended' || status === 'completed';
		}
	});
}

function isPrerequisiteInPlan(moduleId: string): boolean {
	return Object.values(courseStore.studyPlan.nodes).some(
		(node) => node.courseId === moduleId,
	);
}

function openAssessmentInfo() {
	uiStore.toggleAssessmentInfo();
}
</script>

<section class={separated ? 'border-t border-border-primary pt-3' : undefined} aria-labelledby="skill-tree-detail-prerequisites">
  <h3 id="skill-tree-detail-prerequisites" class="flex items-center gap-2 text-sm font-semibold text-text-primary">
    <span class="i-lucide-git-branch h-4 w-4 text-text-secondary" aria-hidden="true"></span>
    {m.prereq_title()}
  </h3>

  {#if assessmentLevelPassed}
    <div class="mt-2 flex items-start gap-2 text-sm">
      <span
        class="{assessmentStageProgress.passed
          ? 'i-lucide-check text-green-500'
          : 'i-lucide-circle text-gray-400'} mt-0.5 h-4 w-4 shrink-0"
        aria-hidden="true"
      ></span>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1">
          <span class="font-semibold {assessmentStageProgress.passed ? 'text-text-primary' : 'text-text-secondary'}">
            {m.prereq_assessment_passed()}
          </span>
          <button
            type="button"
            onclick={openAssessmentInfo}
            class="inline-flex text-blue-500 transition-colors hover:text-blue-600"
            aria-label={m.prereq_assessment_more()}
          >
            <span class="i-lucide-info h-3.5 w-3.5" aria-hidden="true"></span>
          </button>
        </div>
        <p class="mt-0.5 text-xs text-text-tertiary">
          {m.prereq_ects_progress({
            completed: assessmentStageProgress.completedEcts,
            project: assessmentStageProgress.projectEcts,
          })}
        </p>
      </div>
    </div>
  {/if}

  {#if prerequisites.length > 0}
    <ul class="mt-2 space-y-2">
      {#each prerequisites as rule, index}
        {@const ruleData = renderPrerequisiteRule(rule)}
        {@const previousRule = index > 0 ? prerequisites[index - 1] : null}
        {@const showOrSeparator =
          previousRule?.prerequisiteLinkType === 'oder'}
        {@const anyInPlan = rule.modules.some((id) => isPrerequisiteInPlan(id))}
        {@const allInPlan = rule.modules.every((id) => isPrerequisiteInPlan(id))}
        {@const shouldShowRuleWarning =
          rule.moduleLinkType === 'oder' ? !anyInPlan : !allInPlan}

        {#if showOrSeparator}
          <li class="flex items-center gap-2" aria-hidden="true">
            <span class="h-px flex-1 bg-border-primary"></span>
            <span class="text-xs font-medium text-text-tertiary">{m.prereq_or()}</span>
            <span class="h-px flex-1 bg-border-primary"></span>
          </li>
        {/if}

        <li>
          <div class="flex items-start gap-2">
            <span
              class="{ruleData.met
                ? 'i-lucide-check text-green-500'
                : shouldShowRuleWarning
                  ? 'i-lucide-triangle-alert text-yellow-600 dark:text-yellow-500'
                  : 'i-lucide-circle text-gray-400'} mt-0.5 h-4 w-4 shrink-0"
              title={shouldShowRuleWarning ? m.prereq_not_in_plan() : ''}
              aria-hidden="true"
            ></span>
            <div class="min-w-0 flex-1">
              <p
                class="text-sm {ruleData.met
                  ? 'text-text-primary'
                  : shouldShowRuleWarning
                    ? 'text-yellow-700 dark:text-yellow-400'
                    : 'text-text-secondary'}"
              >
                <span class="font-semibold">
                  {rule.mustBePassed ? m.course_completed() : m.course_attended()}
                </span>
                {rule.moduleLinkType === 'oder' ? m.prereq_one_of() : m.prereq_all_of()}
              </p>
              <ul class="mt-1 space-y-1">
                {#each rule.modules as moduleId}
                  {@const course = getCourseById(moduleId)}
                  {@const moduleMet = isModuleMet(moduleId, rule.mustBePassed)}
                  {@const inPlan = isPrerequisiteInPlan(moduleId)}
                  {@const shouldApplyOpacity =
                    !shouldShowRuleWarning && !inPlan}
                  <li class="flex items-start gap-2 text-sm {shouldApplyOpacity ? 'opacity-60' : ''}">
                    <span
                      class="{moduleMet
                        ? 'i-lucide-check text-green-500'
                        : 'i-lucide-minus text-gray-400'} mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    ></span>
                    <span class="min-w-0">
                      <span class="font-mono text-xs font-semibold text-text-secondary">{moduleId}</span>
                      {#if course}
                        <span class="break-words {moduleMet ? 'text-text-primary' : 'text-text-secondary'}">
                          {courseLabel(course)}
                        </span>
                      {/if}
                    </span>
                  </li>
                {/each}
              </ul>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {:else if assessmentLevelPassed}
    <p class="mt-2 text-sm text-text-secondary">{m.prereq_no_other()}</p>
  {:else}
    <p class="mt-2 text-sm text-text-secondary">{m.prereq_none()}</p>
  {/if}
</section>
