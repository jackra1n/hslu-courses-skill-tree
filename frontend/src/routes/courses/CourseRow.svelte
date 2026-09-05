<script lang="ts">
import type { CatalogCourse } from '$lib/data/catalog-types';
import { courseLabel } from '$lib/data/course-label';
import { moduleTypeBadge } from '$lib/data/module-type';
import { type Season, seasonLabel } from '$lib/data/season';
import * as m from '$lib/paraglide/messages';

let { course }: { course: CatalogCourse } = $props();

// The browser is plan-agnostic, so one type per course: the plan default,
// falling back to a season-specific type when no default was computed.
const moduleType = $derived(
	course.typeByPlanSeason.default ??
		course.typeByPlanSeason.HS ??
		course.typeByPlanSeason.FS,
);
const seasons = $derived(course.seasons ?? []);
const prerequisiteIds = $derived([
	...new Set(course.prerequisites.flatMap((rule) => rule.modules)),
]);
const visiblePrerequisites = $derived(prerequisiteIds.slice(0, 3));
const hiddenPrerequisiteCount = $derived(
	prerequisiteIds.length - visiblePrerequisites.length,
);

function seasonTitle(season: Season): string {
	return seasonLabel(season);
}
</script>

<li
	class="rounded-lg border border-border-primary bg-bg-secondary p-3 sm:p-4"
>
	<article class="flex items-start gap-3">
		<div
			class="i-lucide-book-open mt-1 h-5 w-5 shrink-0 text-text-tertiary"
			aria-hidden="true"
		></div>
		<div class="min-w-0 flex-1">
			<h2 class="font-semibold text-text-primary">
				{courseLabel(course)}
			</h2>
			<p class="mt-0.5 text-sm text-text-secondary">
				{course.id} · {course.ects} ECTS
			</p>
			{#if prerequisiteIds.length > 0}
				<p
					class="mt-1 flex items-center gap-1.5 text-xs text-text-secondary"
				>
					<span class="i-lucide-lock h-3.5 w-3.5 shrink-0" aria-hidden="true"></span>
					<span class="truncate">
						{m.prereq_title()}: {visiblePrerequisites.join(', ')}{#if hiddenPrerequisiteCount > 0}
							+{hiddenPrerequisiteCount}{/if}
					</span>
				</p>
			{/if}
			<div class="mt-2 flex flex-wrap items-center gap-1.5">
				{#if moduleType}
					<span
						class="rounded-md border border-border-primary bg-bg-primary px-1.5 py-0.5 text-xs font-medium text-text-secondary"
					>
						{moduleTypeBadge(moduleType)}
					</span>
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
			</div>
		</div>
	</article>
</li>
