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
}: {
	season: Season | 'all';
	moduleTypes: ModuleType[];
	assessmentModes: AssessmentMode[];
	ects: EctsRange;
	nextOnly: boolean;
	ectsSteps: number[];
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

<div class="space-y-2">
	<div class="rounded-lg border border-border-primary bg-bg-secondary p-3">
		<div class="flex items-baseline justify-between gap-2">
			<span class="text-sm text-text-tertiary">{m.browser_filter_ects()}</span>
			<span class="text-sm font-medium text-text-primary">
				{#if ects === null}
					{m.browser_all_ects()}
				{:else}
					{m.browser_ects_range({ min: ects.min, max: ects.max })}
				{/if}
			</span>
		</div>
		{#if ectsSteps.length > 1}
			<div class="relative mt-1 h-8">
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
					class="ects-range absolute inset-0 h-full w-full"
					style="z-index: {lastTouched === 'min' ? 3 : 2}"
				/>
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
					class="ects-range absolute inset-0 h-full w-full"
					style="z-index: {lastTouched === 'max' ? 3 : 2}"
				/>
			</div>
			<div
				class="flex justify-between text-xs text-text-tertiary"
				aria-hidden="true"
			>
				<span>{ectsSteps[0]} ECTS</span>
				<span>{ectsSteps[lastIdx]} ECTS</span>
			</div>
		{/if}
	</div>
	<div class="space-y-1.5">
		<label for={`${id}-season`} class="text-sm font-medium text-text-secondary">{m.browser_filter_season()}</label>
		<Dropdown
			id={`${id}-season`}
			label={m.browser_filter_season()}
			options={seasonOptions}
			selected={season}
			onSelect={(value) => { season = value; }}
		/>
	</div>
	<fieldset class="rounded-lg border border-border-primary bg-bg-secondary px-3 pb-2">
		<legend class="px-1 text-sm font-semibold text-text-primary">{m.browser_filter_type()}</legend>
		{#each moduleTypeOptions as option}
			<label class="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-text-primary">
				<input type="checkbox" bind:group={moduleTypes} value={option} class="h-4 w-4 shrink-0 cursor-pointer accent-blue-500" />
				{moduleTypeLabel(option)}
			</label>
		{/each}
	</fieldset>
	<fieldset class="rounded-lg border border-border-primary bg-bg-secondary px-3 pb-2">
		<legend class="px-1 text-sm font-semibold text-text-primary">{m.assessment_methods()}</legend>
		{#each assessmentModeOptions as option}
			<label class="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-text-primary">
				<input type="checkbox" bind:group={assessmentModes} value={option} class="h-4 w-4 shrink-0 cursor-pointer accent-blue-500" />
				{assessmentModeLabel(option)}
			</label>
		{/each}
	</fieldset>
	<label
		class="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border-primary bg-bg-secondary p-3 transition-colors hover:bg-bg-primary focus-within:border-blue-500"
	>
		<input
			type="checkbox"
			bind:checked={nextOnly}
			class="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-blue-500"
		/>
		<span class="min-w-0">
			<span class="block text-sm font-medium leading-snug text-text-primary">
				{m.browser_next_courses()}
			</span>
			<span class="mt-1 block text-xs leading-relaxed text-text-tertiary">
				{m.browser_next_courses_help()}
			</span>
		</span>
	</label>
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
		margin-top: 6px;
		border-radius: 9999px;
		background-color: rgb(var(--bg-primary));
		border: 2px solid rgb(59 130 246);
		cursor: pointer;
	}
	.ects-range::-moz-range-thumb {
		pointer-events: auto;
		height: 16px;
		width: 16px;
		border-radius: 9999px;
		background-color: rgb(var(--bg-primary));
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
