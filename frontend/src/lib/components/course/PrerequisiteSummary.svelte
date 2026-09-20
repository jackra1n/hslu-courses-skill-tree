<script lang="ts">
import type { Course } from '$lib/data/catalog/catalog-types';
import { courseLabel } from '$lib/data/courses/course-label';
import { getCourseById } from '$lib/data/catalog/courses';
import { summarizePrerequisites } from '$lib/data/courses/prerequisite-summary';
import * as m from '$lib/paraglide/messages';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import { progressStore } from '$lib/stores/progressStore.svelte';
import { getAssessmentStageProgress } from '$lib/utils/status';

let {
	course,
	targetNodeId,
}: { course: Omit<Course, 'type'>; targetNodeId?: string } = $props();
const courseStore = getCourseStore();
const plan = $derived(courseStore.studyPlan);
const hasPlan = $derived(
	Object.values(plan.nodes).some((node) => node.courseId),
);
const groups = $derived(
	summarizePrerequisites(
		course.prerequisites,
		hasPlan ? plan : null,
		progressStore.slotStatus,
		targetNodeId,
	).filter((group) => group.relevant),
);
const assessmentPassed = $derived(
	course.assessmentLevelPassed && hasPlan
		? getAssessmentStageProgress(plan, progressStore.slotStatus).passed
		: false,
);

type CourseState = ReturnType<
	typeof summarizePrerequisites
>[number]['courses'][number]['state'];

function statusColor(state: CourseState) {
	if (state === 'completed' || state === 'attended')
		return 'text-green-700 dark:text-green-400';
	if (state === 'missing' || state === 'later' || state === 'incomplete')
		return 'text-amber-700 dark:text-amber-400';
	return 'text-text-secondary';
}

function statusIcon(state: CourseState) {
	if (state === 'completed' || state === 'attended')
		return 'i-lucide-circle-check';
	if (state === 'missing' || state === 'later' || state === 'incomplete')
		return 'i-lucide-triangle-alert';
	return state === 'planned' ? 'i-lucide-calendar-days' : 'i-lucide-circle';
}

function statusLabel(state: CourseState) {
	switch (state) {
		case 'completed':
			return m.course_completed();
		case 'attended':
			return m.course_attended();
		case 'planned':
			return m.course_summary_planned();
		case 'missing':
			return m.course_summary_missing();
		case 'later':
			return m.course_summary_later();
		case 'incomplete':
			return m.course_summary_incomplete();
		case 'required':
			return m.course_summary_required();
	}
}

function moduleLabel(courseId: string) {
	const prerequisite = getCourseById(courseId);
	return prerequisite ? `${courseId} · ${courseLabel(prerequisite)}` : courseId;
}
</script>

<ul class="mt-3 space-y-2 text-sm leading-snug">
	{#if course.assessmentLevelPassed}
		{@const assessmentStatus = assessmentPassed ? m.course_summary_passed() : hasPlan ? m.course_summary_not_passed() : m.course_summary_required()}
		<li class="flex items-start gap-2" title={assessmentStatus}>
			<span
				class={`mt-0.5 h-4 w-4 shrink-0 ${assessmentPassed ? 'i-lucide-circle-check text-green-700 dark:text-green-400' : hasPlan ? 'i-lucide-triangle-alert text-amber-700 dark:text-amber-400' : 'i-lucide-circle text-text-secondary'}`}
				aria-hidden="true"
			></span>
			<span class="text-text-primary"
				>{m.course_summary_assessment()}
				<span class="sr-only"> — {assessmentStatus}</span></span
			>
		</li>
	{/if}
	{#each groups as group, index (group.ruleIndex)}
		{@const rule = course.prerequisites[group.ruleIndex]}
		<li>
			{#if index > 0 && course.prerequisites[group.ruleIndex - 1].prerequisiteLinkType === 'oder'}
				<p class="mb-1 pl-6 text-xs text-text-secondary">{m.prereq_or()}</p>
			{/if}
			<span class="sr-only">
				{rule.mustBePassed ? m.browser_details_requirement_complete() : m.browser_details_requirement_attend()}
				{rule.moduleLinkType === 'oder' ? m.prereq_one_of() : m.prereq_all_of()}
			</span>
			{#if rule.moduleLinkType === 'oder' && (group.state === 'missing' || group.state === 'required')}
				<div
					class="flex items-start gap-2"
					title={group.courses.map((candidate) => moduleLabel(candidate.courseId)).join(` ${m.course_summary_or()} `)}
				>
					<span
						class={`mt-0.5 h-4 w-4 shrink-0 ${statusIcon(group.state)} ${statusColor(group.state)}`}
						aria-hidden="true"
					></span>
					<p class="min-w-0 text-text-primary">
						{group.courses.map((candidate) => candidate.courseId).join(` ${m.course_summary_or()} `)}
						<span
							class={group.state === 'missing' ? 'text-amber-700 dark:text-amber-400' : 'sr-only'}
						>
							— {statusLabel(group.state)}</span
						>
					</p>
				</div>
			{:else}
				<ul class="space-y-2">
					{#each group.courses as candidate, candidateIndex (candidate.courseId)}
						<li
							class="flex items-start gap-2"
							title={`${moduleLabel(candidate.courseId)} — ${statusLabel(candidate.state)}`}
						>
							<span
								class={`mt-0.5 h-4 w-4 shrink-0 ${statusIcon(candidate.state)} ${statusColor(candidate.state)}`}
								aria-hidden="true"
							></span>
							<p class="min-w-0 text-text-primary">
								{#if candidateIndex > 0 && rule.moduleLinkType === 'oder'}
									<span class="text-text-secondary"
										>{m.course_summary_or()}
									</span>
								{/if}
								{moduleLabel(candidate.courseId)}
								<span
									class={candidate.state === 'missing' || candidate.state === 'later' || candidate.state === 'incomplete' ? 'text-amber-700 dark:text-amber-400' : 'sr-only'}
								>
									— {statusLabel(candidate.state)}</span
								>
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</li>
	{/each}
</ul>
{#if course.prerequisiteNote?.trim()}
	<p
		class="mt-3 flex items-start gap-2 text-xs leading-relaxed text-text-secondary"
	>
		<span
			class="i-lucide-info mt-0.5 h-3.5 w-3.5 shrink-0"
			aria-hidden="true"
		></span>{m.course_summary_notes()}
	</p>
{/if}
