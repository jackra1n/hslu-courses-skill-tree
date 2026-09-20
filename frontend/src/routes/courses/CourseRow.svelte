<script lang="ts">
import ModuleTypeBadge from '$lib/components/ui/ModuleTypeBadge.svelte';
import type { CatalogCourse } from '$lib/data/catalog-types';
import { courseModuleType } from '$lib/data/course-filters';
import { courseLabel } from '$lib/data/course-label';
import { type Season, seasonLabel } from '$lib/data/season';
import * as m from '$lib/paraglide/messages';

let {
	course,
	selected,
	onSelect,
}: {
	course: CatalogCourse;
	selected: boolean;
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
		class="group flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary sm:p-4 {selected
			? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
			: 'border-border-primary bg-bg-secondary hover:border-blue-400 hover:bg-bg-primary'}"
	>
		<span
			class="i-lucide-book-open mt-1 h-5 w-5 shrink-0 text-text-tertiary transition-colors group-hover:text-blue-500"
			aria-hidden="true"
		></span>
		<span class="min-w-0 flex-1">
			<span class="block break-words font-semibold text-text-primary">
				{courseLabel(course)}
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
		<span
			class="i-lucide-chevron-right mt-1 h-4 w-4 shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-secondary {selected
				? 'text-blue-500'
				: ''}"
			aria-hidden="true"
		></span>
	</button>
</li>
