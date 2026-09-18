<script lang="ts">
import * as m from '$lib/paraglide/messages';

let {
	label,
	value = $bindable(0),
	stars = false,
	low,
	high,
}: {
	label: string;
	value?: number;
	stars?: boolean;
	low?: string;
	high?: string;
} = $props();
const id = $props.id();
</script>

<fieldset class="min-w-0">
	<legend class="mb-1 text-sm font-medium text-text-primary">{label}</legend>
	<div class="flex gap-1">
		{#each [1, 2, 3, 4, 5] as score}
			{@const highlighted = stars ? score <= value : score === value}
			<label class="relative flex h-11 w-11 cursor-pointer items-center justify-center">
				<input
					type="radio"
					name={id}
					value={score}
					bind:group={value}
					required
					aria-label={stars ? m.reviews_star_label({ value: score }) : `${score}${score === 1 && low ? `: ${low}` : score === 5 && high ? `: ${high}` : ''}`}
					class="peer sr-only"
				/>
				<span class="flex h-full w-full items-center justify-center rounded-lg border text-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-500 peer-disabled:opacity-50 {highlighted ? 'border-blue-600 bg-blue-600 text-white' : 'border-border-secondary bg-bg-primary text-text-secondary'}">
					{#if stars}
						<svg class="h-6 w-6" viewBox="0 0 24 24" fill={highlighted ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.5" aria-hidden="true">
							<path d="m12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.9L12 3Z" />
						</svg>
					{:else}
						{score}
					{/if}
				</span>
			</label>
		{/each}
	</div>
	{#if low && high}
		<div class="mt-1 flex w-[14.75rem] max-w-full justify-between gap-2 text-xs text-text-secondary">
			<span>1: {low}</span><span class="text-right">5: {high}</span>
		</div>
	{/if}
</fieldset>
