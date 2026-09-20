<script lang="ts">
import Dropdown from '$lib/components/ui/Dropdown.svelte';
import { assessmentModeLabel } from '$lib/data/assessment-mode';
import type { AssessmentMode, ModuleType } from '$lib/data/catalog-types';
import type { EctsRange } from '$lib/data/course-filters';
import { moduleTypeLabel } from '$lib/data/module-type';
import { type Season, seasonLabel } from '$lib/data/season';
import * as m from '$lib/paraglide/messages';

let {
	season = $bindable('all'),
	moduleTypes = $bindable([]),
	assessmentModes = $bindable([]),
	ects = $bindable(null),
	nextOnly = $bindable(false),
	ectsSteps,
	moduleTypeCounts,
	assessmentModeCounts,
	filtering,
	onReset,
}: {
	season: Season | 'all';
	moduleTypes: ModuleType[];
	assessmentModes: AssessmentMode[];
	ects: EctsRange;
	nextOnly: boolean;
	ectsSteps: number[];
	moduleTypeCounts: Partial<Record<ModuleType, number>>;
	assessmentModeCounts: Partial<Record<AssessmentMode, number>>;
	filtering: boolean;
	onReset: () => void;
} = $props();

const id = $props.id();
const seasonOptions = $derived([
	{ value: 'all' as const, label: m.browser_all_seasons() },
	{ value: 'HS' as const, label: seasonLabel('HS') },
	{ value: 'FS' as const, label: seasonLabel('FS') },
]);

const moduleTypeOptions: ModuleType[] = [
	'Kernmodul',
	'Projektmodul',
	'Erweiterungsmodul',
	'Major-/Minormodul',
	'Zusatzmodul',
];

const assessmentModeOptions: AssessmentMode[] = [
	'coursework',
	'written_exam',
	'oral_exam',
	'electronic_exam',
];

// the slider indexes into the distinct ECTS values present in the
// catalog, so every stop matches real courses (no dead zones between
// e.g. 6 and 8 ECTS).
const lastIdx = $derived(ectsSteps.length - 1);
const minIdx = $derived(
	ects === null || ectsSteps.length === 0
		? 0
		: Math.max(0, ectsSteps.indexOf(ects.min)),
);
const maxIdx = $derived(
	ects === null || ectsSteps.length === 0
		? lastIdx
		: Math.max(0, ectsSteps.indexOf(ects.max)),
);
const minPct = $derived(lastIdx > 0 ? (minIdx / lastIdx) * 100 : 0);
const maxPct = $derived(lastIdx > 0 ? (maxIdx / lastIdx) * 100 : 100);

// the topmost thumb grabs the pointer when both sit on one stop; raise
// whichever was touched last so either remains draggable.
let lastTouched = $state<'min' | 'max'>('max');

function setMin(input: HTMLInputElement): void {
	if (ectsSteps.length === 0) return;
	lastTouched = 'min';
	const clamped = Math.min(input.valueAsNumber, maxIdx);
	input.valueAsNumber = clamped;
	ects =
		clamped === 0 && maxIdx === lastIdx
			? null
			: { min: ectsSteps[clamped] ?? 0, max: ectsSteps[maxIdx] ?? 0 };
}

function setMax(input: HTMLInputElement): void {
	if (ectsSteps.length === 0) return;
	lastTouched = 'max';
	const clamped = Math.max(input.valueAsNumber, minIdx);
	input.valueAsNumber = clamped;
	ects =
		minIdx === 0 && clamped === lastIdx
			? null
			: { min: ectsSteps[minIdx] ?? 0, max: ectsSteps[clamped] ?? 0 };
}
</script>

<div class="space-y-4 pb-2 pr-1 lg:space-y-5">
	<div class="flex items-center justify-between gap-3">
		<h2 class="text-lg font-semibold text-text-primary">
			{m.browser_filters()}
		</h2>
		<button
			type="button"
			onclick={onReset}
			disabled={!filtering}
			class="min-h-11 cursor-pointer rounded px-1 text-sm font-medium text-blue-600 hover:underline focus-visible:outline-blue-500 disabled:cursor-default disabled:text-text-secondary disabled:opacity-50 disabled:no-underline dark:text-blue-400 dark:disabled:text-text-secondary"
		>
			{m.browser_reset_all()}
		</button>
	</div>
	<div class="space-y-2">
		<label for={`${id}-season`} class="text-sm font-semibold text-text-primary"
			>{m.browser_filter_season()}</label
		>
		<Dropdown
			id={`${id}-season`}
			label={m.browser_filter_season()}
			options={seasonOptions}
			selected={season}
			onSelect={(value) => { season = value; }}
		/>
	</div>
	<fieldset>
		<legend class="text-sm font-semibold text-text-primary">
			{m.browser_filter_ects()}
		</legend>
		{#if ectsSteps.length > 1}
			<div class="relative mx-2 mt-2 h-11">
				<div
					class="absolute right-0 left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border-primary"
					aria-hidden="true"
				></div>
				<div
					class="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-500"
					style="left: {minPct}%; right: {100 - maxPct}%"
					aria-hidden="true"
				></div>
				<input
					type="range"
					min="0"
					max={lastIdx}
					step="1"
					value={minIdx}
					oninput={(event) => setMin(event.currentTarget)}
					onpointerdown={() => (lastTouched = 'min')}
					onfocus={() => (lastTouched = 'min')}
					aria-label={m.browser_ects_min()}
					aria-valuetext={`${ectsSteps[minIdx]} ECTS`}
					class="ects-range absolute inset-0 h-full w-full"
					style="z-index: {lastTouched === 'min' ? 3 : 2}"
				>
				<input
					type="range"
					min="0"
					max={lastIdx}
					step="1"
					value={maxIdx}
					oninput={(event) => setMax(event.currentTarget)}
					onpointerdown={() => (lastTouched = 'max')}
					onfocus={() => (lastTouched = 'max')}
					aria-label={m.browser_ects_max()}
					aria-valuetext={`${ectsSteps[maxIdx]} ECTS`}
					class="ects-range absolute inset-0 h-full w-full"
					style="z-index: {lastTouched === 'max' ? 3 : 2}"
				>
			</div>
		{/if}
		<p class="mt-1 text-sm text-text-secondary">
			{ectsSteps.length ? m.browser_ects_range({ min: ects?.min ?? ectsSteps[0], max: ects?.max ?? ectsSteps[lastIdx] }) : m.browser_all_ects()}
		</p>
	</fieldset>
	<div class="border-t border-border-primary pt-4 lg:pt-5">
		<fieldset>
			<legend class="mb-2 text-sm font-semibold text-text-primary">
				{m.browser_filter_type()}
			</legend>
			{#each moduleTypeOptions as option, index (option)}
				<label
					class="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary focus-within:outline focus-within:outline-blue-500"
				>
					<input
						type="checkbox"
						bind:group={moduleTypes}
						value={option}
						aria-labelledby={`${id}-type-${index}`}
						aria-describedby={`${id}-type-count-${index}`}
						class="h-5 w-5 shrink-0 cursor-pointer accent-blue-500"
					>
					<span id={`${id}-type-${index}`} class="min-w-0 flex-1 break-words"
						>{moduleTypeLabel(option)}</span
					>
					<span
						id={`${id}-type-count-${index}`}
						class="rounded bg-bg-secondary px-1.5 text-xs tabular-nums text-text-secondary"
						>{moduleTypeCounts[option] ?? 0}</span
					>
				</label>
			{/each}
		</fieldset>
	</div>
	<div class="border-t border-border-primary pt-4 lg:pt-5">
		<fieldset>
			<legend class="mb-2 text-sm font-semibold text-text-primary">
				{m.assessment_methods()}
			</legend>
			{#each assessmentModeOptions as option, index (option)}
				<label
					class="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary focus-within:outline focus-within:outline-blue-500"
				>
					<input
						type="checkbox"
						bind:group={assessmentModes}
						value={option}
						aria-labelledby={`${id}-mode-${index}`}
						aria-describedby={`${id}-mode-count-${index}`}
						class="h-5 w-5 shrink-0 cursor-pointer accent-blue-500"
					>
					<span id={`${id}-mode-${index}`} class="min-w-0 flex-1 break-words"
						>{assessmentModeLabel(option)}</span
					>
					<span
						id={`${id}-mode-count-${index}`}
						class="rounded bg-bg-secondary px-1.5 text-xs tabular-nums text-text-secondary"
						>{assessmentModeCounts[option] ?? 0}</span
					>
				</label>
			{/each}
		</fieldset>
	</div>
	<div class="border-t border-border-primary pt-4 lg:pt-5">
		<label
			class="block cursor-pointer rounded-md focus-within:outline focus-within:outline-blue-500"
		>
			<span
				id={`${id}-next-label`}
				class="block text-sm font-semibold text-text-primary"
				>{m.browser_next_courses()}</span
			>
			<span class="mt-2 flex min-h-11 items-center gap-3">
				<span class="relative inline-flex h-6 w-11 shrink-0">
					<input
						type="checkbox"
						role="switch"
						bind:checked={nextOnly}
						aria-labelledby={`${id}-next-label`}
						aria-describedby={`${id}-next-help`}
						class="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
					>
					<span
						class="h-6 w-11 rounded-full bg-border-primary transition-colors peer-checked:bg-blue-600 motion-reduce:transition-none"
					></span>
					<span
						class="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 motion-reduce:transition-none"
					></span>
				</span>
				<span
					id={`${id}-next-help`}
					class="text-xs leading-relaxed text-text-secondary"
					>{m.browser_next_courses_help()}</span
				>
			</span>
		</label>
	</div>
</div>

<style>
.ects-range {
	-webkit-appearance: none;
	appearance: none;
	background: transparent;
	pointer-events: none;
	margin: 0;
}
.ects-range::-webkit-slider-runnable-track {
	background: transparent;
}
.ects-range::-moz-range-track {
	background: transparent;
}
.ects-range::-webkit-slider-thumb {
	-webkit-appearance: none;
	appearance: none;
	pointer-events: auto;
	height: 20px;
	width: 20px;
	margin-top: 0;
	border-radius: 9999px;
	background-color: rgb(59 130 246);
	border: 2px solid rgb(59 130 246);
	cursor: pointer;
}
.ects-range::-moz-range-thumb {
	pointer-events: auto;
	height: 16px;
	width: 16px;
	border-radius: 9999px;
	background-color: rgb(59 130 246);
	border: 2px solid rgb(59 130 246);
	cursor: pointer;
}
.ects-range:focus-visible {
	outline: none;
}
.ects-range:focus-visible::-webkit-slider-thumb {
	box-shadow: 0 0 0 3px rgba(59 130 246 / 0.4);
}
.ects-range:focus-visible::-moz-range-thumb {
	box-shadow: 0 0 0 3px rgba(59 130 246 / 0.4);
}
</style>
