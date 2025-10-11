<script lang="ts">
  import type { PrerequisiteExpression, Course } from '$lib/types';
  import { COURSES } from '$lib/data/courses';
  import { progressStore } from '$lib/stores/progressStore.svelte';
  import { evaluatePrerequisite } from '$lib/utils/prerequisite';
  import { 
    isCreditRequirement,
    isProgramSpecificRequirement,
    isPrerequisiteRequirement,
    isAssessmentStageRequirement,
    isAndExpression,
    isOrExpression,
    calculateCreditsCompleted,
    calculateCreditsAttended
  } from '$lib/data/courses';

  let { prereqs }: { prereqs: PrerequisiteExpression[] } = $props();

  const attended = $derived(progressStore.attendedSet);
  const completed = $derived(progressStore.completedSet);

  function renderPrerequisite(prereq: PrerequisiteExpression, depth = 0) {
    const prereqMet = evaluatePrerequisite(prereq, attended, completed);
    
    return {
      prereq,
      met: prereqMet,
      depth
    };
  }
</script>

{#if prereqs && prereqs.length > 0}
  <div class="border-t border-border-primary pt-4">
    <h3 class="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
      <div class="i-lucide-git-branch text-text-secondary"></div>
      Prerequisites
    </h3>
    <ul class="space-y-1.5">
      {#each prereqs as prereq}
        {@const prereqData = renderPrerequisite(prereq)}
        
        {#if isCreditRequirement(prereq)}
          <li class="flex items-start gap-2 text-sm">
            <div class="{prereqData.met ? 'i-lucide-check text-green-500' : 'i-lucide-circle text-gray-400'} mt-0.5"></div>
            <div class="flex-1">
              <div class={prereqData.met ? 'text-text-primary' : 'text-text-secondary'}>
                <span class="font-medium">
                  {prereq.moduleType ? `${prereq.moduleType} Credits` : 'Total Credits'}:
                </span>
                <span class="ml-2">
                  {prereq.moduleType 
                    ? `${calculateCreditsCompleted(completed, prereq.moduleType)}/${prereq.minCredits} ECTS`
                    : `${calculateCreditsAttended(attended, completed)}/${prereq.minCredits} ECTS`
                  }
                </span>
              </div>
            </div>
          </li>
        {:else if isProgramSpecificRequirement(prereq)}
          <li class="flex items-start gap-2 text-sm">
            <div class="{prereqData.met ? 'i-lucide-check text-green-500' : 'i-lucide-minus text-gray-400'} mt-0.5"></div>
            <div class="flex-1">
              <div class={prereqData.met ? 'text-text-primary' : 'text-text-secondary'}>
                <span class="font-medium">{prereq.program}:</span>
                <div class="ml-2 mt-1 space-y-1">
                  {#each prereq.requirements as req}
                    {@const reqMet = evaluatePrerequisite(req, progressStore.attended, progressStore.completed)}
                    <div class="flex items-center gap-1.5 text-xs">
                      <div class="{reqMet ? 'i-lucide-check text-green-500' : 'i-lucide-circle text-gray-400'} text-xs"></div>
                      <span class={reqMet ? 'text-text-primary' : 'text-text-secondary'}>
                        {#if isCreditRequirement(req)}
                          {req.moduleType ? `${req.moduleType} Credits` : 'Total Credits'}: {req.moduleType 
                            ? `${calculateCreditsCompleted(progressStore.completed, req.moduleType)}/${req.minCredits} ECTS`
                            : `${calculateCreditsAttended(progressStore.attended, progressStore.completed)}/${req.minCredits} ECTS`
                          }
                        {:else if isPrerequisiteRequirement(req)}
                          {req.requirement === "besucht" ? "Attended" : "Completed"}: {req.courses.join(", ")}
                        {/if}
                      </span>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          </li>
        {:else if isAssessmentStageRequirement(prereq)}
          <li class="flex items-start gap-2 text-sm">
            <div class="{prereqData.met ? 'i-lucide-check text-green-500' : 'i-lucide-circle text-gray-400'} mt-0.5"></div>
            <div class="flex-1">
              <div class={prereqData.met ? 'text-text-primary' : 'text-text-secondary'}>
                <span class="font-medium">Assessment Stage Passed</span>
                <div class="text-xs text-text-tertiary">
                  ({progressStore.completed.size}/6+ courses completed)
                </div>
              </div>
            </div>
          </li>
        {:else if isAndExpression(prereq)}
          {#each prereq.operands as operand}
            {@const operandMet = evaluatePrerequisite(operand, attended, completed)}
            <li class="flex items-start gap-2 text-sm">
              <div class="{operandMet ? 'i-lucide-check text-green-500' : 'i-lucide-circle text-gray-400'} mt-0.5"></div>
              <div class="flex-1">
                <span class={operandMet ? 'text-text-primary' : 'text-text-secondary'}>
                  {#if isPrerequisiteRequirement(operand)}
                    {operand.requirement === "besucht" ? "Attended" : "Completed"}: {operand.courses.join(", ")}
                  {:else if isAssessmentStageRequirement(operand)}
                    Assessment Stage Passed
                  {:else if isOrExpression(operand)}
                    One of: {operand.operands.map(op => {
                      if (isPrerequisiteRequirement(op)) {
                        const requirementText = op.requirement === "besucht" ? "Attended" : "Completed";
                        const courseNames = op.courses.map(courseId => COURSES.find(c => c.id === courseId)?.label || courseId).join(', ');
                        return `${requirementText}: ${courseNames}`;
                      }
                      return 'Complex requirement';
                    }).join(' OR ')}
                  {:else}
                    Complex requirement
                  {/if}
                </span>
              </div>
            </li>
          {/each}
        {:else if isOrExpression(prereq)}
          {#each prereq.operands as operand}
            {@const operandMet = evaluatePrerequisite(operand, attended, completed)}
            <li class="flex items-start gap-2 text-sm">
              <div class="{operandMet ? 'i-lucide-check text-green-500' : 'i-lucide-circle text-gray-400'} mt-0.5"></div>
              <div class="flex-1">
                <span class={operandMet ? 'text-text-primary' : 'text-text-secondary'}>
                  {#if isPrerequisiteRequirement(operand)}
                    {operand.requirement === "besucht" ? "Attended" : "Completed"}: {operand.courses.join(", ")}
                  {:else if isAssessmentStageRequirement(operand)}
                    Assessment Stage Passed
                  {:else if isAndExpression(operand)}
                    All of: {operand.operands.map(op => {
                      if (isPrerequisiteRequirement(op)) {
                        const requirementText = op.requirement === "besucht" ? "Attended" : "Completed";
                        const courseNames = op.courses.map(courseId => COURSES.find(c => c.id === courseId)?.label || courseId).join(', ');
                        return `${requirementText}: ${courseNames}`;
                      } else if (isOrExpression(op)) {
                        return `(${op.operands.map(subOp => {
                          if (isPrerequisiteRequirement(subOp)) {
                            const requirementText = subOp.requirement === "besucht" ? "Attended" : "Completed";
                            const courseNames = subOp.courses.map(courseId => COURSES.find(c => c.id === courseId)?.label || courseId).join(', ');
                            return `${requirementText}: ${courseNames}`;
                          }
                          return 'Complex';
                        }).join(' OR ')})`;
                      }
                      return 'Complex requirement';
                    }).join(' AND ')}
                  {:else}
                    Complex requirement
                  {/if}
                </span>
              </div>
            </li>
          {/each}
        {:else}
          <li class="flex items-start gap-2 text-sm">
            <div class="{prereqData.met ? 'i-lucide-check text-green-500' : 'i-lucide-circle text-gray-400'} mt-0.5"></div>
            <div class="flex-1">
              <div class={prereqData.met ? 'text-text-primary' : 'text-text-secondary'}>
                <span class="font-medium">{prereq.requirement === "besucht" ? "Attended" : "Completed"}:</span>
                <div class="ml-2 mt-1 space-y-1">
                  {#each prereq.courses as courseId}
                    {@const course = COURSES.find(c => c.id === courseId)}
                    {@const courseMet = prereq.requirement === "besucht" ? (progressStore.attended.has(courseId) || progressStore.completed.has(courseId)) : progressStore.completed.has(courseId)}
                    <div class="flex items-center gap-1.5 text-xs">
                      <div class="{courseMet ? 'i-lucide-check text-green-500' : 'i-lucide-circle text-gray-400'} text-xs"></div>
                      <span class={courseMet ? 'text-text-primary' : 'text-text-secondary'}>
                        {course?.label || courseId}
                      </span>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          </li>
        {/if}
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
