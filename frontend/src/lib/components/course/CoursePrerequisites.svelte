<script lang="ts">
import type { Course } from '$lib/data/catalog/catalog-types';
import { courseLabel } from '$lib/data/courses/course-label';
import { getCourseById } from '$lib/data/catalog/courses';
import {
	buildPrerequisiteExpression,
	type PrerequisiteExpression,
} from '$lib/data/courses/prerequisite-expression';
import {
	type PrerequisiteCourseSummary,
	type PrerequisiteRuleSummary,
	summarizePrerequisites,
} from '$lib/data/courses/prerequisite-summary';
import * as m from '$lib/paraglide/messages';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import { progressStore } from '$lib/stores/progressStore.svelte';
import {
	getAssessmentStageProgress,
	hasAssessmentStageViolation,
} from '$lib/utils/status';

let {
	course,
	targetNodeId,
	onNavigate,
}: {
	course: Omit<Course, 'type'>;
	targetNodeId?: string;
	onNavigate: (courseId: string) => void;
} = $props();
const id = $props.id();
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
		{ includeAlternatives: true },
	),
);
const expression = $derived(buildPrerequisiteExpression(course.prerequisites));
const assessment = $derived(
	getAssessmentStageProgress(plan, progressStore.slotStatus),
);
const assessmentPlacement = $derived(
	!!targetNodeId &&
		course.assessmentLevelPassed &&
		!assessment.passed &&
		hasAssessmentStageViolation(plan, targetNodeId),
);
const note = $derived(course.prerequisiteNote?.trim());

function isExpressionSatisfied(node: PrerequisiteExpression): boolean {
	if ('ruleIndex' in node) return groups[node.ruleIndex].state === 'satisfied';
	return node.operator === 'and'
		? node.children.every(isExpressionSatisfied)
		: node.children.some(isExpressionSatisfied);
}

function isMet(candidate: PrerequisiteCourseSummary) {
	return candidate.state === 'completed' || candidate.state === 'attended';
}

function needsAttention(group: PrerequisiteRuleSummary) {
	return (
		group.relevant &&
		(group.state === 'missing' ||
			group.state === 'later' ||
			group.state === 'incomplete')
	);
}

function rowWarning(
	candidate: PrerequisiteCourseSummary,
	group: PrerequisiteRuleSummary,
) {
	return (
		needsAttention(group) &&
		(candidate.state === 'missing' ||
			candidate.state === 'later' ||
			candidate.state === 'incomplete')
	);
}

function statusLabel(candidate: PrerequisiteCourseSummary) {
	switch (candidate.state) {
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

function groupTitle(index: number) {
	const rule = course.prerequisites[index];
	if (rule.modules.length === 1)
		return rule.mustBePassed
			? m.prerequisites_complete()
			: m.prerequisites_attend();
	if (rule.moduleLinkType === 'oder')
		return rule.mustBePassed
			? m.prerequisites_complete_one()
			: m.prerequisites_attend_one();
	return rule.mustBePassed
		? m.prerequisites_complete_all()
		: m.prerequisites_attend_all();
}
</script>

{#snippet candidateContent(candidate: PrerequisiteCourseSummary, group: PrerequisiteRuleSummary)}
	{@const prerequisite = getCourseById(candidate.courseId)}
	<span
		class={`mt-0.5 h-4 w-4 shrink-0 ${isMet(candidate) ? 'i-lucide-circle-check text-green-800 dark:text-green-400' : rowWarning(candidate, group) ? 'i-lucide-triangle-alert text-amber-700 dark:text-amber-400' : candidate.state === 'planned' ? 'i-lucide-calendar-days text-text-secondary' : 'i-lucide-circle text-text-secondary'}`}
		aria-hidden="true"
	></span>
	<span class="min-w-0 flex-1">
		<span class="block break-words text-sm leading-snug text-text-primary">
			<span class="mr-1 font-mono text-xs text-text-secondary"
				>{candidate.courseId}</span
			>
			{#if prerequisite}
				{courseLabel(prerequisite)}
			{/if}
		</span>
		<span
			class={`mt-0.5 block text-xs leading-relaxed ${isMet(candidate) ? 'text-green-800 dark:text-green-400' : rowWarning(candidate, group) ? 'text-amber-700 dark:text-amber-400' : 'text-text-secondary'}`}
		>
			{statusLabel(candidate)}
			{#if (candidate.state === 'planned' || candidate.state === 'later') && candidate.semesters.length}
				·
				{candidate.semesters.map((number) => m.details_semester({ number })).join(', ')}
			{/if}
		</span>
	</span>
	{#if prerequisite}
		<span
			class="i-lucide-chevron-right mt-0.5 h-4 w-4 shrink-0 text-text-secondary"
			aria-hidden="true"
		></span>
	{/if}
{/snippet}

{#snippet requirementGroup(index: number)}
	{@const group = groups[index]}
	{@const rule = course.prerequisites[index]}
	{@const required = rule.moduleLinkType === 'oder' ? 1 : rule.modules.length}
	{@const satisfied = group.state === 'satisfied'}
	<section
		class={`overflow-hidden rounded-lg border ${satisfied ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/50' : 'border-border-primary bg-bg-secondary'}`}
		aria-labelledby={`${id}-group-${index}`}
	>
		<header
			class={`border-b px-3 py-2.5 ${satisfied ? 'border-green-200 bg-green-100/70 dark:border-green-800 dark:bg-green-900/30' : 'border-border-primary bg-bg-primary/40'}`}
		>
			<div
				class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
			>
				<h4
					id={`${id}-group-${index}`}
					class="text-sm font-semibold text-text-primary"
				>
					{groupTitle(index)}
				</h4>
				<span
					class={`inline-flex items-center gap-1.5 text-xs font-medium ${satisfied ? 'text-green-800 dark:text-green-400' : needsAttention(group) ? 'text-amber-700 dark:text-amber-400' : 'text-text-secondary'}`}
				>
					{#if satisfied}
						<span
							class="i-lucide-circle-check h-3.5 w-3.5 shrink-0"
							aria-hidden="true"
						></span>
					{/if}
					{satisfied ? m.prerequisites_met() : !group.relevant ? m.prerequisites_alternative() : needsAttention(group) ? m.prerequisites_needs_attention() : group.state === 'planned' ? m.course_summary_planned() : m.course_summary_required()}
				</span>
			</div>
			{#if rule.modules.length > 1}
				<p class="mt-1 text-xs text-text-secondary">
					{m.prerequisites_required_count({ count: required, total: rule.modules.length })}
				</p>
			{/if}
		</header>
		<ul
			class={`divide-y ${satisfied ? 'divide-green-200 dark:divide-green-800' : 'divide-border-primary'}`}
		>
			{#each group.courses as candidate (candidate.courseId)}
				<li>
					{#if getCourseById(candidate.courseId)}
						<button
							type="button"
							onclick={() => onNavigate(candidate.courseId)}
							class={`flex min-h-11 w-full cursor-pointer items-start gap-2.5 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${satisfied ? 'hover:bg-green-100 dark:hover:bg-green-900/50' : 'hover:bg-bg-primary'}`}
						>
							{@render candidateContent(candidate, group)}
						</button>
					{:else}
						<div class="flex items-start gap-2.5 px-3 py-2.5">
							{@render candidateContent(candidate, group)}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/snippet}

{#snippet requirementExpression(node: PrerequisiteExpression)}
	{#if 'ruleIndex' in node}
		{@render requirementGroup(node.ruleIndex)}
	{:else}
		{@const satisfied = isExpressionSatisfied(node)}
		<div
			class={`space-y-3 rounded-lg border p-3 ${satisfied ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/50' : 'border-border-primary bg-bg-secondary'}`}
		>
			<div
				class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
			>
				<p class="text-sm font-medium text-text-secondary">
					{node.operator === 'and' ? m.prerequisites_all_groups() : m.prerequisites_one_group()}
				</p>
				{#if satisfied}
					<span
						class="inline-flex items-center gap-1.5 text-xs font-medium text-green-800 dark:text-green-400"
					>
						<span
							class="i-lucide-circle-check h-3.5 w-3.5 shrink-0"
							aria-hidden="true"
						></span>
						{m.prerequisites_met()}
					</span>
				{/if}
			</div>
			{#each node.children as child (child)}
				{@render requirementExpression(child)}
			{/each}
		</div>
	{/if}
{/snippet}

<section aria-labelledby={`${id}-title`} class="space-y-4">
	<h3 id={`${id}-title`} class="text-sm font-semibold text-text-primary">
		{m.prereq_title()}
	</h3>
	{#if course.assessmentLevelPassed}
		<section
			class={`rounded-lg border p-3 ${hasPlan && assessment.passed ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/50' : 'border-border-primary'}`}
			aria-labelledby={`${id}-assessment`}
		>
			<div class="flex items-start gap-2.5">
				<span
					class={`mt-0.5 h-4 w-4 shrink-0 ${assessment.passed && hasPlan ? 'i-lucide-circle-check text-green-800 dark:text-green-400' : 'i-lucide-badge-check text-text-secondary'}`}
					aria-hidden="true"
				></span>
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-baseline justify-between gap-2">
						<h4
							id={`${id}-assessment`}
							class="text-sm font-semibold text-text-primary"
						>
							{m.course_summary_assessment()}
						</h4>
						<span
							class={`text-xs font-medium ${hasPlan && assessment.passed ? 'text-green-800 dark:text-green-400' : hasPlan ? 'text-amber-700 dark:text-amber-400' : 'text-text-secondary'}`}
							>{!hasPlan ? m.course_summary_required() : assessment.passed ? m.course_summary_passed() : m.course_summary_not_passed()}</span
						>
					</div>
				</div>
			</div>
			{#if hasPlan}
				<p class="mt-2 text-xs leading-relaxed text-text-secondary">
					{m.prereq_ects_progress({ completed: assessment.completedEcts, project: assessment.projectEcts })}
				</p>
			{/if}
			{#if assessmentPlacement}
				<p
					class="mt-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400"
				>
					{m.warning_assessment_message()}
				</p>
			{/if}
			<details class="mt-2 text-xs text-text-secondary">
				<summary
					class="cursor-pointer py-2 text-blue-600 focus-visible:outline-blue-500 dark:text-blue-400"
				>
					{m.prereq_assessment_more()}
				</summary>
				<p class="mb-2 leading-relaxed">
					{m.prerequisites_assessment_required()}
				</p>
				<ul class="mt-1 list-disc space-y-1 pl-4 leading-relaxed">
					<li>{m.assessment_definitiv()}</li>
					<li>{m.assessment_bedingt()}</li>
				</ul>
			</details>
		</section>
	{/if}
	{#if expression}
		{@render requirementExpression(expression)}
	{:else if !course.assessmentLevelPassed && !note}
		<p class="text-sm text-text-secondary">{m.prereq_none()}</p>
	{/if}
	{#if note}
		<section
			class="border-t border-border-primary pt-4"
			aria-labelledby={`${id}-note`}
		>
			<h4 id={`${id}-note`} class="text-sm font-semibold text-text-primary">
				{m.course_details_note()}
			</h4>
			<p
				class="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-secondary"
			>
				{note}
			</p>
		</section>
	{/if}
</section>
