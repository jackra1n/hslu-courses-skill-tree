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
            <div class="{prereqData.met ? 'i-lucide-check text-green-500' : 'i-lucide-circle text-gray-400'} mt-0.5"></div>
            <div class="flex-1">
              <div class={prereqData.met ? 'text-text-primary' : 'text-text-secondary'}>
                <span class="font-medium">{prereq.program}:</span>
                <div class="ml-2 mt-1 space-y-1">
                  {#each prereq.requirements as req}
                    {@const reqMet = evaluatePrerequisite(req, attended, completed)}
                    <div class="flex items-center gap-1.5 text-xs">
                      <div class="{reqMet ? 'i-lucide-check text-green-500' : 'i-lucide-minus text-gray-400'} text-xs"></div>
                      <span class={reqMet ? 'text-text-primary' : 'text-text-secondary'}>
                        {#if isCreditRequirement(req)}
                          {req.moduleType ? `${req.moduleType} Credits` : 'Total Credits'}: {req.moduleType 
                            ? `${calculateCreditsCompleted(completed, req.moduleType)}/${req.minCredits} ECTS`
                            : `${calculateCreditsAttended(attended, completed)}/${req.minCredits} ECTS`
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
                  ({completed.size}/6+ courses completed)
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
                {#if isPrerequisiteRequirement(operand)}
                  <div class={operandMet ? 'text-text-primary' : 'text-text-secondary'}>
                    <span><span class="font-semibold">{operand.requirement === "besucht" ? "Attended" : "Completed"}</span> all of:</span>
                    <div class="ml-2 mt-1 space-y-1">
                      {#each operand.courses as courseId}
                        {@const course = COURSES.find(c => c.id === courseId)}
                        {@const courseMet = operand.requirement === "besucht" ? (attended.has(courseId) || completed.has(courseId)) : completed.has(courseId)}
                        <div class="flex items-center gap-1.5 text-xs">
                          <div class="{courseMet ? 'i-lucide-check text-green-500' : 'i-lucide-minus text-gray-400'} text-xs"></div>
                          <span class={courseMet ? 'text-text-primary' : 'text-text-secondary'}>
                            {course?.label || courseId}
                          </span>
                        </div>
                      {/each}
                    </div>
                  </div>
                {:else if isAssessmentStageRequirement(operand)}
                  <div class={operandMet ? 'text-text-primary' : 'text-text-secondary'}>
                    <span class="font-medium">Assessment Stage Passed</span>
                    <div class="text-xs text-text-tertiary">
                      ({completed.size}/6+ courses completed)
                    </div>
                  </div>
                {:else if isOrExpression(operand)}
                  <div class={operandMet ? 'text-text-primary' : 'text-text-secondary'}>
                    <span><span class="font-semibold">{operand.operands.find(op => isPrerequisiteRequirement(op))?.requirement === "besucht" ? "Attended" : "Completed"}</span> one of:</span>
                    <div class="ml-2 mt-1 space-y-1">
                      {#each operand.operands as op}
                        {@const opMet = evaluatePrerequisite(op, attended, completed)}
                        {#if isPrerequisiteRequirement(op)}
                          <div class="flex items-center gap-1.5 text-xs">
                            <div class="{opMet ? 'i-lucide-check text-green-500' : 'i-lucide-minus text-gray-400'} text-xs"></div>
                            <span class={opMet ? 'text-text-primary' : 'text-text-secondary'}>
                              {op.courses.map(courseId => COURSES.find(c => c.id === courseId)?.label || courseId).join(", ")}
                            </span>
                          </div>
                        {:else if isAndExpression(op)}
                          <div class="flex items-center gap-1.5 text-xs">
                            <div class="{opMet ? 'i-lucide-check text-green-500' : 'i-lucide-minus text-gray-400'} text-xs"></div>
                            <span class="font-medium">Attended all of:</span>
                          </div>
                          <div class="ml-4 mt-1 space-y-1">
                            {#each op.operands as nestedOp}
                              {#if isPrerequisiteRequirement(nestedOp)}
                                {#each nestedOp.courses as courseId}
                                  {@const course = COURSES.find(c => c.id === courseId)}
                                  {@const courseMet = nestedOp.requirement === "besucht" ? (attended.has(courseId) || completed.has(courseId)) : completed.has(courseId)}
                                  <div class="flex items-center gap-1.5 text-xs">
                                    <div class="{courseMet ? 'i-lucide-check text-green-500' : 'i-lucide-minus text-gray-400'} text-xs"></div>
                                    <span class={courseMet ? 'text-text-primary' : 'text-text-secondary'}>
                                      {course?.label || courseId}
                                    </span>
                                  </div>
                                {/each}
                              {/if}
                            {/each}
                          </div>
                        {/if}
                      {/each}
                    </div>
                  </div>
                {:else}
                  <span class={operandMet ? 'text-text-primary' : 'text-text-secondary'}>
                    Complex requirement
                  </span>
                {/if}
              </div>
            </li>
          {/each}
        {:else if isOrExpression(prereq)}
          {#each prereq.operands as operand}
            {@const operandMet = evaluatePrerequisite(operand, attended, completed)}
            <li class="flex items-start gap-2 text-sm">
              <div class="{operandMet ? 'i-lucide-check text-green-500' : 'i-lucide-circle text-gray-400'} mt-0.5"></div>
              <div class="flex-1">
                {#if isPrerequisiteRequirement(operand)}
                  <div class={operandMet ? 'text-text-primary' : 'text-text-secondary'}>
                    <span><span class="font-semibold">{operand.requirement === "besucht" ? "Attended" : "Completed"}</span> one of:</span>
                    <div class="ml-2 mt-1 space-y-1">
                      {#each operand.courses as courseId}
                        {@const course = COURSES.find(c => c.id === courseId)}
                        {@const courseMet = operand.requirement === "besucht" ? (attended.has(courseId) || completed.has(courseId)) : completed.has(courseId)}
                        <div class="flex items-center gap-1.5 text-xs">
                          <div class="{courseMet ? 'i-lucide-check text-green-500' : 'i-lucide-minus text-gray-400'} text-xs"></div>
                          <span class={courseMet ? 'text-text-primary' : 'text-text-secondary'}>
                            {course?.label || courseId}
                          </span>
                        </div>
                      {/each}
                    </div>
                  </div>
                {:else if isAssessmentStageRequirement(operand)}
                  <div class={operandMet ? 'text-text-primary' : 'text-text-secondary'}>
                    <span class="font-medium">Assessment Stage Passed</span>
                    <div class="text-xs text-text-tertiary">
                      ({completed.size}/6+ courses completed)
                    </div>
                  </div>
                {:else if isAndExpression(operand)}
                  <div class={operandMet ? 'text-text-primary' : 'text-text-secondary'}>
                    <span><span class="font-semibold">{operand.operands.find(op => isPrerequisiteRequirement(op))?.requirement === "besucht" ? "Attended" : "Completed"}</span> all of:</span>
                    <div class="ml-2 mt-1 space-y-1">
                      {#each operand.operands as op}
                        {@const opMet = evaluatePrerequisite(op, attended, completed)}
                        {#if isPrerequisiteRequirement(op)}
                          <div class="flex items-center gap-1.5 text-xs">
                            <div class="{opMet ? 'i-lucide-check text-green-500' : 'i-lucide-minus text-gray-400'} text-xs"></div>
                            <span class={opMet ? 'text-text-primary' : 'text-text-secondary'}>
                              {op.courses.map(courseId => COURSES.find(c => c.id === courseId)?.label || courseId).join(", ")}
                            </span>
                          </div>
                        {/if}
                      {/each}
                    </div>
                  </div>
                {:else}
                  <span class={operandMet ? 'text-text-primary' : 'text-text-secondary'}>
                    Complex requirement
                  </span>
                {/if}
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
                    {@const courseMet = prereq.requirement === "besucht" ? (attended.has(courseId) || completed.has(courseId)) : completed.has(courseId)}
                    <div class="flex items-center gap-1.5 text-xs">
                      <div class="{courseMet ? 'i-lucide-check text-green-500' : 'i-lucide-minus text-gray-400'} text-xs"></div>
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
