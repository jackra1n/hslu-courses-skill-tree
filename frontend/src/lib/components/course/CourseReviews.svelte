<script lang="ts">
import { onMount, tick } from 'svelte';
import ConfirmationDialog from '$lib/components/ui/ConfirmationDialog.svelte';
import {
	deleteCourseReview,
	fetchCourseReviews,
	ReviewApiError,
	saveCourseReview,
} from '$lib/data/review-client';
import type {
	CourseReviewsResponse,
	ReviewInput,
} from '$lib/data/review-types';
import * as m from '$lib/paraglide/messages';
import { cloudSyncStore } from '$lib/stores/cloudSyncStore.svelte';
import { locale } from '$lib/stores/locale.svelte';
import ReviewForm from './ReviewForm.svelte';
import ReviewRatingDetails from './ReviewRatingDetails.svelte';
import ReviewStars from './ReviewStars.svelte';

let {
	courseId,
	onReviewSummary,
}: {
	courseId: string;
	onReviewSummary?: (
		courseId: string,
		summary: CourseReviewsResponse['summary'],
	) => void;
} = $props();
const id = $props.id();
// the parent keys this component by course and signed-in user. Old reads and
// writes cannot update a newly selected course or another user's editor.
const controller = new AbortController();
let data = $state<CourseReviewsResponse | null>(null);
let loading = $state(true);
let loadFailed = $state(false);
let editing = $state(false);
let confirmingDelete = $state(false);
let busy = $state<'saving' | 'deleting' | 'signing-in' | null>(null);
let error = $state<
	'save' | 'delete' | 'session' | 'conflict' | 'invalid' | 'sign-in' | null
>(null);
let notice = $state<'saved' | 'deleted' | null>(null);
let heading: HTMLHeadingElement;
let errorElement = $state<HTMLDivElement>();
let actionButton = $state<HTMLButtonElement>();
const user = $derived(cloudSyncStore.user);
const ownReview = $derived(
	user
		? data?.reviews.find((review) => review.id === data?.ownReviewId)
		: undefined,
);
const numberFormat = $derived(
	new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }),
);
const dateFormat = $derived(
	new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }),
);
const dimensions = $derived([
	{
		key: 'recommendation' as const,
		label: m.reviews_recommendation(),
		stars: true,
		hint: '',
	},
	{
		key: 'contentInterest' as const,
		label: m.reviews_content_interest(),
		stars: true,
		hint: '',
	},
	{
		key: 'difficulty' as const,
		label: m.reviews_difficulty(),
		stars: false,
		hint: `1: ${m.reviews_easy()} · 5: ${m.reviews_hard()}`,
	},
	{
		key: 'workload' as const,
		label: m.reviews_workload(),
		stars: false,
		hint: `1: ${m.reviews_low()} · 5: ${m.reviews_high()}`,
	},
]);
const errorMessage = $derived.by(() => {
	switch (error) {
		case 'session':
			return m.reviews_session_expired();
		case 'conflict':
			return m.reviews_conflict();
		case 'invalid':
			return m.reviews_invalid();
		case 'delete':
			return m.reviews_delete_error();
		case 'sign-in':
			return m.account_sign_in_failed();
		case 'save':
			return m.reviews_save_error();
		default:
			return '';
	}
});

async function load(afterWrite = false): Promise<void> {
	loading = true;
	loadFailed = false;
	const requestedCourseId = courseId;
	const publishSummary = onReviewSummary;
	try {
		// A persisted write must refresh the course list even if its panel closes.
		const next = await fetchCourseReviews(
			requestedCourseId,
			afterWrite ? undefined : controller.signal,
		);
		if (afterWrite || !controller.signal.aborted) {
			publishSummary?.(requestedCourseId, next.summary);
		}
		if (!controller.signal.aborted) data = next;
	} catch {
		if (!controller.signal.aborted) {
			data = null;
			loadFailed = true;
		}
	} finally {
		if (!controller.signal.aborted) loading = false;
	}
}

onMount(() => {
	void load();
	return () => controller.abort();
});

async function showError(
	cause: unknown,
	fallback: 'save' | 'delete',
): Promise<void> {
	if (controller.signal.aborted) return;
	error = fallback;
	if (cause instanceof ReviewApiError) {
		switch (cause.status) {
			case 401:
				error = 'session';
				break;
			case 404:
			case 409:
				error = 'conflict';
				break;
			case 400:
			case 413:
				error = 'invalid';
				break;
		}
	}
	await tick();
	errorElement?.focus();
}

async function save(input: ReviewInput): Promise<void> {
	if (busy || !user) return;
	busy = 'saving';
	error = null;
	notice = null;
	try {
		await saveCourseReview(
			courseId,
			ownReview?.id ?? null,
			input,
			controller.signal,
		);
		if (controller.signal.aborted) return;
		editing = false;
		notice = 'saved';
		// a failed refresh is a read error, not a failed save. Never invite a
		// second POST after the first one has already persisted successfully.
		await load(true);
		await tick();
		if (!controller.signal.aborted) heading.focus();
	} catch (cause) {
		await showError(cause, 'save');
	} finally {
		if (!controller.signal.aborted) busy = null;
	}
}

async function remove(): Promise<void> {
	confirmingDelete = false;
	if (busy || !ownReview) return;
	busy = 'deleting';
	error = null;
	notice = null;
	try {
		await deleteCourseReview(ownReview.id, controller.signal);
		if (controller.signal.aborted) return;
		notice = 'deleted';
		await load(true);
		await tick();
		if (!controller.signal.aborted) heading.focus();
	} catch (cause) {
		await showError(cause, 'delete');
	} finally {
		if (!controller.signal.aborted) busy = null;
	}
}

async function signIn(): Promise<void> {
	busy = 'signing-in';
	error = null;
	const callback = new URL(window.location.href);
	callback.searchParams.set('course', courseId);
	await cloudSyncStore.signInWithGitHub(callback.href);
	if (!controller.signal.aborted) {
		busy = null;
		if (cloudSyncStore.errorMessage) error = 'sign-in';
	}
}

async function cancelEditing(): Promise<void> {
	editing = false;
	error = null;
	await tick();
	actionButton?.focus();
}

async function reload(): Promise<void> {
	editing = false;
	error = null;
	await load();
	await tick();
	if (!controller.signal.aborted) heading.focus();
}
</script>

<section aria-labelledby={`${id}-title`}>
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<h3 bind:this={heading} id={`${id}-title`} tabindex="-1" class="text-sm font-semibold text-text-primary focus:outline-none">{m.reviews_title()}</h3>
		{#if data}<span class="text-xs text-text-secondary">{m.reviews_count({ count: data.summary.count })}</span>{/if}
	</div>

	{#if notice}
		<p role="status" class="mt-3 text-sm text-text-primary">{notice === 'saved' ? m.reviews_saved() : m.reviews_deleted()}</p>
	{/if}
	{#if error}
		<div bind:this={errorElement} role="alert" tabindex="-1" class="mt-3 rounded-lg border border-red-500 p-3 text-sm text-red-700 focus:outline-none dark:text-red-300">
			<p>{errorMessage}</p>
			{#if error === 'session'}
				<button type="button" onclick={signIn} disabled={busy !== null} class="mt-2 min-h-11 rounded-lg border border-border-secondary px-3 font-medium text-text-primary disabled:opacity-50">{m.account_continue_github()}</button>
			{:else if error === 'conflict'}
				<button type="button" onclick={reload} disabled={busy !== null} class="mt-2 min-h-11 rounded-lg border border-border-secondary px-3 font-medium text-text-primary disabled:opacity-50">{m.reviews_reload()}</button>
			{/if}
		</div>
	{/if}

	{#if loading}
		<p role="status" class="mt-3 text-sm text-text-secondary">{m.reviews_loading()}</p>
	{:else if loadFailed}
		<p role="alert" class="mt-3 text-sm text-text-secondary">{m.reviews_load_error()}</p>
		<button type="button" onclick={() => load()} class="mt-2 min-h-11 rounded-lg border border-border-secondary px-3 text-sm text-text-primary">{m.common_retry()}</button>
	{:else if data}
		{#if data.summary.count > 0}
			<dl aria-label={m.reviews_averages()} class="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
				{#each dimensions as dimension}
					{@const average = data.summary[dimension.key]}
					<div>
						<dt class="text-xs text-text-secondary">{dimension.label}</dt>
						<dd class="mt-0.5 flex items-center gap-1 text-lg font-semibold text-text-primary">
							{#if average === null}
								{m.course_details_unknown()}
							{:else if dimension.stars}
								<ReviewStars value={average} label={m.reviews_star_label({ value: numberFormat.format(average) })} />
							{:else}
								{numberFormat.format(average)}
							{/if}
						</dd>
						{#if dimension.hint}<dd class="mt-0.5 text-xs text-text-secondary">{dimension.hint}</dd>{/if}
					</div>
				{/each}
			</dl>
		{:else}
			<p class="mt-3 text-sm text-text-secondary">{m.reviews_empty()}</p>
		{/if}

		<div class="mt-4">
			{#if !user}
				<p class="text-sm text-text-secondary">{m.reviews_sign_in()}</p>
				<button type="button" onclick={signIn} disabled={busy !== null} class="mt-2 min-h-11 rounded-lg border border-border-secondary bg-bg-primary px-4 text-sm font-medium text-text-primary hover:bg-bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50">{m.account_continue_github()}</button>
			{:else if editing}
				<ReviewForm initial={ownReview} busy={busy !== null} onSave={save} onCancel={cancelEditing} />
			{:else}
				<div class="flex flex-wrap gap-2">
					<button bind:this={actionButton} type="button" disabled={busy !== null} onclick={() => { editing = true; error = null; notice = null; }} class="min-h-11 rounded-lg border border-border-secondary bg-bg-primary px-4 text-sm font-medium text-text-primary hover:bg-bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50">{ownReview ? m.reviews_edit() : m.reviews_write()}</button>
					{#if ownReview}
						<button type="button" disabled={busy !== null} onclick={() => (confirmingDelete = true)} class="min-h-11 rounded-lg px-3 text-sm text-red-700 hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 disabled:opacity-50 dark:text-red-300">{m.reviews_delete()}</button>
					{/if}
				</div>
			{/if}
		</div>
		{#if busy === 'deleting'}<p role="status" class="mt-2 text-sm text-text-secondary">{m.reviews_deleting()}</p>{/if}

		<ul class="mt-4 space-y-3">
			{#each data.reviews as review (review.id)}
				<li>
					<article class="rounded-lg border border-border-primary bg-bg-primary p-3">
						<header class="flex items-center justify-between gap-2 text-xs">
							<div class="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-1">
								{#if review.id === ownReview?.id}
									<h4 class="font-semibold text-text-primary">{m.reviews_yours()}</h4>
								{/if}
								<time datetime={new Date(review.createdAt).toISOString()} class="text-text-secondary">{dateFormat.format(review.createdAt)}</time>
							</div>
							<ReviewRatingDetails {review} />
						</header>
						{#if review.text}<p class="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-text-primary [overflow-wrap:anywhere]">{review.text}</p>{/if}
						{#if review.updatedAt > review.createdAt}<p class="mt-2 text-xs text-text-secondary">{m.reviews_updated({ date: dateFormat.format(review.updatedAt) })}</p>{/if}
					</article>
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if confirmingDelete}
	<ConfirmationDialog title={m.reviews_delete_title()} message={m.reviews_delete_message()} confirmText={m.reviews_delete()} onConfirm={remove} onCancel={() => (confirmingDelete = false)} />
{/if}
