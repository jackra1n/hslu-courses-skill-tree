<script lang="ts">
import type { ModuleType } from '$lib/data/catalog-types';
import type { EctsRange } from '$lib/data/course-filters';
import { moduleTypeLabel } from '$lib/data/module-type';
import { type Season, seasonLabel } from '$lib/data/season';
import * as m from '$lib/paraglide/messages';

let {
	season = $bindable('all'),
	moduleType = $bindable('all'),
	ects = $bindable(null),
	ectsSteps,
}: {
	season: Season | 'all';
	moduleType: ModuleType | 'all';
	ects: EctsRange;
	ectsSteps: number[];
} = $props();

const moduleTypeOptions: (ModuleType | 'all')[] = [
	'all',
	'Kernmodul',
	'Projektmodul',
	'Erweiterungsmodul',
	'Major-/Minormodul',
	'Zusatzmodul',
];

// The slider indexes into the distinct ECTS values present in the
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

// The topmost thumb grabs the pointer when both sit on one stop; raise
// whichever was touched last so either remains draggable.
let lastTouched = $state<'min' | 'max'>('max');

function setMin(idx: number): void {
	if (ectsSteps.length === 0) return;
	lastTouched = 'min';
	const clamped = Math.min(idx, maxIdx);
	ects =
		clamped === 0 && maxIdx === lastIdx
			? null
			: { min: ectsSteps[clamped] ?? 0, max: ectsSteps[maxIdx] ?? 0 };
}

function setMax(idx: number): void {
	if (ectsSteps.length === 0) return;
	lastTouched = 'max';
	const clamped = Math.max(idx, minIdx);
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
					oninput={(event) => setMin(Number(event.currentTarget.value))}
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
					oninput={(event) => setMax(Number(event.currentTarget.value))}
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
	<label
		class="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-border-primary bg-bg-secondary px-3 text-sm transition-colors focus-within:border-blue-500"
	>
		<span class="shrink-0 text-text-tertiary">{m.browser_filter_season()}</span>
		<select
			bind:value={season}
			aria-label={m.browser_filter_season()}
			class="h-full min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent pr-6 font-medium text-text-primary focus:outline-none"
		>
			<option value="all">{m.browser_all_seasons()}</option>
			<option value="HS">{seasonLabel('HS')}</option>
			<option value="FS">{seasonLabel('FS')}</option>
		</select>
		<span
			class="i-lucide-chevron-down pointer-events-none -ml-6 h-4 w-4 shrink-0 text-text-tertiary"
			aria-hidden="true"
		></span>
	</label>
	<label
		class="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-border-primary bg-bg-secondary px-3 text-sm transition-colors focus-within:border-blue-500"
	>
		<span class="shrink-0 text-text-tertiary">{m.browser_filter_type()}</span>
		<select
			bind:value={moduleType}
			aria-label={m.browser_filter_type()}
			class="h-full min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent pr-6 font-medium text-text-primary focus:outline-none"
		>
			{#each moduleTypeOptions as option (option)}
				<option value={option}>
					{option === 'all' ? m.browser_all_types() : moduleTypeLabel(option)}
				</option>
			{/each}
		</select>
		<span
			class="i-lucide-chevron-down pointer-events-none -ml-6 h-4 w-4 shrink-0 text-text-tertiary"
			aria-hidden="true"
		></span>
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
