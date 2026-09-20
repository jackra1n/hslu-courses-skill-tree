<script lang="ts">
import type { Review } from '$lib/data/reviews/review-types';
import * as m from '$lib/paraglide/messages';
import ReviewStars from './ReviewStars.svelte';

let { review }: { review: Review } = $props();
const id = $props.id();
let open = $state(false);
let pinned = false;
let hovering = false;
let root: HTMLDivElement;
let trigger: HTMLButtonElement;
let popover: HTMLDivElement;
let closeTimer: ReturnType<typeof setTimeout> | undefined;

function position() {
	const anchor = trigger.getBoundingClientRect();
	const viewport = window.visualViewport;
	const leftEdge = (viewport?.offsetLeft ?? 0) + 8;
	const topEdge = (viewport?.offsetTop ?? 0) + 8;
	const width = viewport?.width ?? document.documentElement.clientWidth;
	const height = viewport?.height ?? window.innerHeight;
	popover.style.maxWidth = `${Math.max(0, width - 16)}px`;
	popover.style.maxHeight = `${Math.max(0, height - 16)}px`;
	const bounds = popover.getBoundingClientRect();
	const rightLimit = leftEdge + width - 16 - bounds.width;
	const bottomLimit = topEdge + height - 16 - bounds.height;
	const below = anchor.bottom + 8;
	const top = below <= bottomLimit ? below : anchor.top - bounds.height - 8;
	popover.style.left = `${Math.max(leftEdge, Math.min(anchor.right - bounds.width, rightLimit))}px`;
	popover.style.top = `${Math.max(topEdge, Math.min(top, bottomLimit))}px`;
}

function show() {
	clearTimeout(closeTimer);
	open = true;
}

function close() {
	clearTimeout(closeTimer);
	pinned = false;
	if (open) popover.hidePopover();
	open = false;
}

function scheduleClose() {
	clearTimeout(closeTimer);
	closeTimer = setTimeout(() => {
		if (!pinned && !hovering && !trigger.matches(':focus-visible')) close();
	}, 150);
}

function enter(event: PointerEvent) {
	if (event.pointerType !== 'mouse') return;
	hovering = true;
	show();
}

function leave() {
	hovering = false;
	scheduleClose();
}

function toggle() {
	if (pinned) {
		close();
	} else {
		pinned = true;
		show();
	}
}

function blur() {
	pinned = false;
	scheduleClose();
}

$effect(() => {
	if (!open) return;
	popover.showPopover();
	position();

	const outside = (event: PointerEvent) => {
		if (!root.contains(event.target as Node)) close();
	};
	const handleEscape = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		// consume Escape before the surrounding course panel's document listener.
		event.preventDefault();
		event.stopPropagation();
		close();
	};
	const viewport = window.visualViewport;
	const resizeObserver = new ResizeObserver(position);
	resizeObserver.observe(popover);
	document.addEventListener('pointerdown', outside, true);
	document.addEventListener('keydown', handleEscape, true);
	document.addEventListener('scroll', position, true);
	window.addEventListener('resize', position);
	viewport?.addEventListener('resize', position);
	viewport?.addEventListener('scroll', position);
	return () => {
		resizeObserver.disconnect();
		document.removeEventListener('pointerdown', outside, true);
		document.removeEventListener('keydown', handleEscape, true);
		document.removeEventListener('scroll', position, true);
		window.removeEventListener('resize', position);
		viewport?.removeEventListener('resize', position);
		viewport?.removeEventListener('scroll', position);
	};
});

$effect(() => () => clearTimeout(closeTimer));
</script>

<div
	bind:this={root}
	class="inline-flex shrink-0 self-start"
	role="group"
	onpointerenter={enter}
	onpointerleave={leave}
>
	<button
		bind:this={trigger}
		type="button"
		class="flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-sm p-0 text-text-secondary hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
		aria-label={m.reviews_rating_details()}
		aria-expanded={open}
		aria-controls={`${id}-ratings`}
		aria-describedby={open ? `${id}-ratings` : undefined}
		onfocus={() => { if (trigger.matches(':focus-visible')) show(); }}
		onblur={blur}
		onclick={toggle}
	>
		<span class="i-lucide-info h-4 w-4" aria-hidden="true"></span>
	</button>
	<div
		bind:this={popover}
		id={`${id}-ratings`}
		popover="manual"
		role="tooltip"
		class="fixed inset-auto m-0 w-72 overflow-y-auto rounded-lg border border-border-primary bg-bg-primary p-3 text-sm text-text-primary shadow-xl"
	>
		{#if open}
			<dl class="space-y-3">
				<div>
					<dt class="mb-1 font-medium">{m.reviews_recommendation()}</dt>
					<dd>
						<ReviewStars
							value={review.recommendation}
							label={m.reviews_star_label({ value: review.recommendation })}
						/>
					</dd>
				</div>
				<div>
					<dt class="mb-1 font-medium">{m.reviews_content_interest()}</dt>
					<dd>
						<ReviewStars
							value={review.contentInterest}
							label={m.reviews_star_label({ value: review.contentInterest })}
						/>
					</dd>
				</div>
				<div>
					<dt class="font-medium">{m.reviews_difficulty()}</dt>
					<dd>
						<span class="font-semibold tabular-nums"
							>{review.difficulty}/5</span
						>
						<span
							class="mt-1 flex justify-between gap-3 text-xs text-text-secondary"
							><span>1: {m.reviews_easy()}</span
							><span class="text-right">5: {m.reviews_hard()}</span></span
						>
					</dd>
				</div>
				<div>
					<dt class="font-medium">{m.reviews_workload()}</dt>
					<dd>
						<span class="font-semibold tabular-nums">{review.workload}/5</span>
						<span
							class="mt-1 flex justify-between gap-3 text-xs text-text-secondary"
							><span>1: {m.reviews_low()}</span
							><span class="text-right">5: {m.reviews_high()}</span></span
						>
					</dd>
				</div>
			</dl>
		{/if}
	</div>
</div>
