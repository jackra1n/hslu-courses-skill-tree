<script lang="ts">
import Dropdown from '$lib/components/ui/Dropdown.svelte';
import { courseLabel } from '$lib/data/courses/course-label';
import { COURSES, type Course } from '$lib/data/catalog/courses';
import { type Season, seasonLabel } from '$lib/data/season';
import * as m from '$lib/paraglide/messages';
import { getCourseStore } from '$lib/stores/courseStore.svelte';

let { slotId }: { slotId: string } = $props();
const id = $props.id();

const courseStore = getCourseStore();

const selectedCourseId = $derived(courseStore.userSelections[slotId]);

const slotNode = $derived(courseStore.studyPlan.nodes[slotId]);

const availableCourses = $derived(
	COURSES.filter((course) => {
		if (!slotNode) return false;
		if (selectedCourseId === course.id) return true;
		return courseStore.canSelectCourseForSlot(slotId, course.id);
	}),
);

const slotSeason = $derived(
	slotNode ? courseStore.seasonOf(slotNode.semester) : null,
);

function isOfferedIn(course: Course, season: Season): boolean {
	return (
		!course.seasons ||
		course.seasons.length === 0 ||
		course.seasons.includes(season)
	);
}

const courseOptions = $derived.by(() => {
	const options = availableCourses.map((course) => {
		const outOfSeason = slotSeason !== null && !isOfferedIn(course, slotSeason);
		return {
			value: course.id,
			label: m.elective_option_label({
				name: courseLabel(course),
				id: course.id,
				ects: course.ects,
			}),
			// search matches either language, regardless of the active locale
			keywords: [course.label, course.labelEn ?? '', course.id],
			// keep an already-chosen course usable even if the start season later changed
			disabled: outOfSeason && course.id !== selectedCourseId,
			tooltip: outOfSeason
				? m.elective_only_offered({
						seasons: formatSeasons(course.seasons),
					})
				: undefined,
		};
	});
	// out-of-season (disabled) courses sink to the bottom; order is otherwise stable
	return options.sort((a, b) => Number(a.disabled) - Number(b.disabled));
});

function formatSeasons(seasons: Season[] | undefined): string {
	if (!seasons || seasons.length === 0) return m.elective_other_semesters();
	return (['HS', 'FS'] as Season[])
		.filter((s) => seasons.includes(s))
		.map((s) => seasonLabel(s))
		.join(' & ');
}

function handleCourseSelect(courseId: string) {
	if (courseId) {
		courseStore.selectCourseForSlot(slotId, courseId);
	} else {
		courseStore.clearSlotSelection(slotId);
	}
}

function clearSelection() {
	courseStore.clearSlotSelection(slotId);
}
</script>

<div class="border-t border-border-primary pt-4">
	<h3
		class="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2"
	>
		<div class="i-lucide-book-plus text-text-secondary"></div>
		{m.elective_select_title()}
	</h3>
	<div class="space-y-3">
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<label for={id} class="text-sm font-medium text-text-primary">
					{m.elective_choose()}
				</label>
				{#if selectedCourseId}
					<button
						onclick={clearSelection}
						class="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
					>
						{m.common_clear()}
					</button>
				{/if}
			</div>
			<Dropdown
				options={courseOptions}
				selected={selectedCourseId || ''}
				onSelect={handleCourseSelect}
				placeholder={m.elective_placeholder()}
				searchPlaceholder={m.elective_search()}
				noResultsText={m.elective_no_results()}
				{id}
				label={m.elective_choose()}
				searchable
			/>
		</div>
	</div>
</div>
