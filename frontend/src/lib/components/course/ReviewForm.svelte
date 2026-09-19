<script lang="ts">
import { onMount, untrack } from 'svelte';
import type { Review, ReviewInput } from '$lib/data/review-types';
import * as m from '$lib/paraglide/messages';
import ReviewRating from './ReviewRating.svelte';

let {
	initial,
	busy,
	onSave,
	onCancel,
}: {
	initial: Review | undefined;
	busy: boolean;
	onSave: (input: ReviewInput) => Promise<void>;
	onCancel: () => void;
} = $props();

let recommendation = $state(untrack(() => initial?.recommendation ?? 0));
let contentInterest = $state(untrack(() => initial?.contentInterest ?? 0));
let difficulty = $state(untrack(() => initial?.difficulty ?? 0));
let workload = $state(untrack(() => initial?.workload ?? 0));
let text = $state(untrack(() => initial?.text ?? ''));
let form: HTMLFormElement;
const id = $props.id();

onMount(() => form.querySelector<HTMLInputElement>('input')?.focus());

async function submit(event: SubmitEvent): Promise<void> {
	event.preventDefault();
	if (busy) return;
	await onSave({ recommendation, contentInterest, difficulty, workload, text });
}
</script>

<form bind:this={form} onsubmit={submit} class="space-y-4 rounded-lg border border-border-secondary bg-bg-primary p-3" aria-label={initial ? m.reviews_edit() : m.reviews_write()} aria-describedby={`${id}-privacy`}>
	<p id={`${id}-privacy`} class="text-xs leading-relaxed text-text-secondary">{m.reviews_privacy()}</p>
	<p class="text-xs text-text-secondary">{m.reviews_required()}</p>
	<fieldset disabled={busy} class="min-w-0 space-y-4">
		<ReviewRating label={m.reviews_recommendation()} bind:value={recommendation} stars />
		<ReviewRating label={m.reviews_content_interest()} bind:value={contentInterest} stars />
		<ReviewRating label={m.reviews_difficulty()} bind:value={difficulty} low={m.reviews_easy()} high={m.reviews_hard()} />
		<ReviewRating label={m.reviews_workload()} bind:value={workload} low={m.reviews_low()} high={m.reviews_high()} />
		<p class="text-xs leading-relaxed text-text-secondary">{m.reviews_scale_hint()}</p>
		<div>
			<label for={`${id}-text`} class="block text-sm font-medium text-text-primary">{m.reviews_text()}</label>
			<p id={`${id}-hint`} class="mt-1 text-xs text-text-secondary">{m.reviews_text_hint()}</p>
			<textarea id={`${id}-text`} bind:value={text} maxlength="5000" rows="4" aria-describedby={`${id}-hint ${id}-count`} class="mt-2 block w-full resize-y rounded-lg border border-border-secondary bg-bg-primary p-3 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"></textarea>
			<p id={`${id}-count`} class="mt-1 text-right text-xs text-text-secondary">{m.reviews_text_count({ count: text.length })}</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<button type="submit" class="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50">
				{busy ? m.reviews_saving() : initial ? m.reviews_save() : m.reviews_submit()}
			</button>
			<button type="button" onclick={onCancel} class="min-h-11 rounded-lg border border-border-secondary px-4 py-2 text-sm text-text-primary hover:bg-bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">{m.common_cancel()}</button>
		</div>
	</fieldset>
</form>
