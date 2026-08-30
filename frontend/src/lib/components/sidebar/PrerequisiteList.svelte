<script lang="ts">
import * as messages from '$lib/paraglide/messages';
import { getCourseById } from '$lib/data/courses';
import { courseLabel } from '$lib/data/course-label';
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
}: {
	prerequisites: PrerequisiteRule[];
	assessmentLevelPassed?: boolean;
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

{#if prerequisites && prerequisites.length > 0}
  <div class="border-t border-border-primary pt-4">
    <h3
      class="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2"
    >
      <div class="i-lucide-git-branch text-text-secondary"></div>
      {messages.prereq_title()}
    </h3>

    {#if assessmentLevelPassed}
      <div class="mb-3 flex items-start gap-2 text-sm">
        <div
          class="{assessmentStageProgress.passed
            ? 'i-lucide-check text-green-500'
            : 'i-lucide-circle text-gray-400'} mt-0.5"
        ></div>
        <div class="flex-1">
          <div
            class={assessmentStageProgress.passed
              ? "text-text-primary"
              : "text-text-secondary"}
          >
            <div class="flex items-center gap-1">
              <span class="font-semibold">{messages.prereq_assessment_passed()}</span>
              <button
                onclick={openAssessmentInfo}
                class="text-blue-500 hover:text-blue-600 transition-colors inline-flex items-center"
                aria-label={messages.prereq_assessment_more()}
              >
                <div class="i-lucide-info text-xs"></div>
              </button>
            </div>
            <div class="text-xs opacity-60 mt-0.5">
              {messages.prereq_ects_progress({
									completed: assessmentStageProgress.completedEcts,
									project: assessmentStageProgress.projectEcts,
								})}
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
              {messages.prereq_or()}
            </div>
          </li>
        {/if}

        {@const anyInPlan = rule.modules.some((id) => isPrerequisiteInPlan(id))}
        {@const allInPlan = rule.modules.every((id) =>
          isPrerequisiteInPlan(id)
        )}
        {@const shouldShowRuleWarning =
          rule.moduleLinkType === "oder" ? !anyInPlan : !allInPlan}

        <li class="flex items-start gap-2 text-sm">
          <div
            class="{ruleData.met
              ? 'i-lucide-check text-green-500'
              : shouldShowRuleWarning
                ? 'i-lucide-triangle-alert text-yellow-600 dark:text-yellow-500'
                : 'i-lucide-circle text-gray-400'} mt-0.5"
            title={shouldShowRuleWarning
              ? messages.prereq_not_in_plan()
              : ""}
          ></div>
          <div class="flex-1">
            <div
              class={ruleData.met
                ? "text-text-primary"
                : shouldShowRuleWarning
                  ? "text-yellow-600 dark:text-yellow-500"
                  : "text-text-secondary"}
            >
              <div class="flex items-center gap-1">
                <span class="font-semibold"
                  >{rule.mustBePassed ? messages.course_completed() : messages.course_attended()}</span
                >
                <span
                  >{rule.moduleLinkType === "oder"
                    ? messages.prereq_one_of()
                    : messages.prereq_all_of()}</span
                >
              </div>
              <div class="ml-2 mt-1 space-y-1">
                {#each rule.modules as moduleId}
                  {@const course = getCourseById(moduleId)}
                  {@const moduleMet = isModuleMet(moduleId, rule.mustBePassed)}
                  {@const inPlan = isPrerequisiteInPlan(moduleId)}
                  {@const shouldApplyOpacity = !shouldShowRuleWarning && !inPlan}
                  <div class="flex items-center gap-1.5 text-xs">
                    <div
                      class="{moduleMet
                        ? 'i-lucide-check text-green-500'
                        : 'i-lucide-minus text-gray-400'} text-xs {shouldApplyOpacity
                        ? 'opacity-60'
                        : ''}"
                    ></div>
                    <span
                      class="{moduleMet
                        ? 'text-text-primary'
                        : 'text-text-secondary'} {shouldApplyOpacity ? 'opacity-60' : ''}"
                    >
                      {course ? courseLabel(course) : moduleId}
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
      {messages.prereq_title()}
    </h3>

    {#if assessmentLevelPassed}
      <div class="mb-3 flex items-start gap-2 text-sm">
        <div
          class="{assessmentStageProgress.passed
            ? 'i-lucide-check text-green-500'
            : 'i-lucide-circle text-gray-400'} mt-0.5"
        ></div>
        <div class="flex-1">
          <div
            class={assessmentStageProgress.passed
              ? "text-text-primary"
              : "text-text-secondary"}
          >
            <div class="flex items-center gap-1">
              <span class="font-semibold">{messages.prereq_assessment_passed()}</span>
              <button
                onclick={openAssessmentInfo}
                class="text-blue-500 hover:text-blue-600 ml-1 transition-colors inline-flex items-center"
                aria-label={messages.prereq_assessment_more()}
              >
                <div class="i-lucide-info text-xs"></div>
              </button>
            </div>
            <div class="text-xs opacity-60 mt-0.5">
              {messages.prereq_ects_progress({
									completed: assessmentStageProgress.completedEcts,
									project: assessmentStageProgress.projectEcts,
								})}
            </div>
          </div>
        </div>
      </div>
      <p class="text-sm text-text-secondary">{messages.prereq_no_other()}</p>
    {:else}
      <p class="text-sm text-text-secondary">{messages.prereq_none()}</p>
    {/if}
  </div>
{/if}
