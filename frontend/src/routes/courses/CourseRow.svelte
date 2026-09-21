<script lang="ts">
import ModuleTypeBadge from '$lib/components/ui/ModuleTypeBadge.svelte';
import type { CatalogCourse } from '$lib/data/catalog/catalog-types';
import type { CourseReviewScore } from '$lib/data/reviews/review-types';
import { courseModuleType } from '$lib/data/courses/course-filters';
import { courseLabel } from '$lib/data/courses/course-label';
import { type Season, seasonLabel } from '$lib/data/season';
import * as m from '$lib/paraglide/messages';
import { locale } from '$lib/stores/locale.svelte';

let {
	course,
	selected,
	reviewScore,
	onSelect,
}: {
	course: CatalogCourse;
	selected: boolean;
	reviewScore: CourseReviewScore | null | undefined;
	onSelect: (course: CatalogCourse, trigger: HTMLButtonElement) => void;
} = $props();

const moduleType = $derived(courseModuleType(course));
const seasons = $derived(course.seasons ?? []);
const prerequisiteIds = $derived([
	...new Set(course.prerequisites.flatMap((rule) => rule.modules)),
]);
const visiblePrerequisites = $derived(prerequisiteIds.slice(0, 3));
const hiddenPrerequisiteCount = $derived(
	prerequisiteIds.length - visiblePrerequisites.length,
);
const numberFormat = $derived(
	new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }),
);

function seasonTitle(season: Season): string {
	return seasonLabel(season);
}
</script>

<li>
	<button
		type="button"
		onclick={(event) => onSelect(course, event.currentTarget)}
		aria-expanded={selected}
		aria-controls="course-detail-panel"
		class="block w-full cursor-pointer rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary sm:p-4 {selected
			? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
			: 'border-border-primary bg-bg-secondary hover:border-blue-400 hover:bg-bg-primary'}"
	>
		<span class="block min-w-0">
			<span class="flex items-start gap-3">
				<span
					class="min-w-0 flex-1 break-words font-semibold text-text-primary"
				>
					{courseLabel(course)}
				</span>
				{#if reviewScore}
					{@const score = numberFormat.format(reviewScore.recommendation)}
					<span
						role="img"
						aria-label={m.browser_course_review_summary({
							score,
							count: reviewScore.count,
						})}
						title={m.browser_course_review_summary({
							score,
							count: reviewScore.count,
						})}
						class="mt-0.5 inline-flex shrink-0 items-center gap-1 tabular-nums"
					>
						<span
							class="i-lucide-star h-3.5 w-3.5 fill-current text-blue-600 dark:text-blue-400"
							aria-hidden="true"
						></span>
						<span class="font-semibold text-text-primary">{score}</span>
						<span class="text-xs text-text-tertiary"
							>({numberFormat.format(reviewScore.count)})</span
						>
					</span>
				{/if}
			</span>
			<span class="mt-0.5 block text-sm text-text-secondary">
				{course.id}
				· {course.ects} ECTS
			</span>
			{#if prerequisiteIds.length > 0}
				<span
					class="mt-1 flex items-center gap-1.5 text-xs text-text-secondary"
				>
					<span
						class="i-lucide-lock h-3.5 w-3.5 shrink-0"
						aria-hidden="true"
					></span>
					<span class="min-w-0 truncate">
						{m.prereq_title()}:
						{visiblePrerequisites.join(', ')}
						{#if hiddenPrerequisiteCount > 0}
							+{hiddenPrerequisiteCount}
						{/if}
					</span>
				</span>
			{/if}
			<span class="mt-2 flex flex-wrap items-center gap-1.5">
				{#if moduleType}
					<ModuleTypeBadge type={moduleType} short />
				{/if}
				{#each seasons as season (season)}
					<span
						class="rounded-md border border-border-primary bg-bg-primary px-1.5 py-0.5 text-xs font-medium text-text-secondary"
						title={seasonTitle(season)}
					>
						{season}
					</span>
				{/each}
				{#if course.assessmentLevelPassed}
					<span
						class="flex items-center rounded-md border border-border-primary bg-bg-primary px-1.5 py-0.5 text-text-secondary"
						title={m.prereq_assessment_passed()}
						aria-label={m.prereq_assessment_passed()}
					>
						<span
							class="i-lucide-badge-check h-3.5 w-3.5"
							aria-hidden="true"
						></span>
					</span>
				{/if}
			</span>
		</span>
	</button>
</li>
