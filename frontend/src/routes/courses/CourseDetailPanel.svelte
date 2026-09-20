<script lang="ts">
import { onMount, tick } from 'svelte';
import CourseDetailContent from '$lib/components/course/CourseDetailContent.svelte';
import type { CatalogCourse } from '$lib/data/catalog-types';
import { courseModuleType } from '$lib/data/course-filters';
import type { CourseReviewsResponse } from '$lib/data/review-types';
import * as m from '$lib/paraglide/messages';

let {
	course,
	courseById,
	onClose,
	onNavigate,
	onReviewSummary,
}: {
	course: CatalogCourse | null;
	courseById: ReadonlyMap<string, CatalogCourse>;
	onClose: () => void;
	onNavigate: (course: CatalogCourse) => void;
	onReviewSummary?: (
		courseId: string,
		summary: CourseReviewsResponse['summary'],
	) => void;
} = $props();

const TITLE_ID = 'course-browser-detail-title';

let panel: HTMLElement;
let content = $state<HTMLDivElement>();
let closeButton = $state<HTMLButtonElement>();
let isOverlay = $state(false);

const moduleType = $derived(course ? courseModuleType(course) : undefined);

function focusableElements(): HTMLElement[] {
	return Array.from(
		panel.querySelectorAll<HTMLElement>(
			'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
		),
	).filter(
		(element) =>
			element.tabIndex >= 0 &&
			!element.matches(':disabled') &&
			element.getClientRects().length > 0,
	);
}

function handleKeydown(event: KeyboardEvent): void {
	if (!course || !isOverlay || event.key !== 'Tab') return;

	const focusable = focusableElements();
	const first = focusable[0];
	const last = focusable.at(-1);
	if (!first || !last) return;

	if (event.shiftKey && document.activeElement === first) {
		event.preventDefault();
		last.focus();
	} else if (!event.shiftKey && document.activeElement === last) {
		event.preventDefault();
		first.focus();
	}
}

onMount(() => {
	const media = window.matchMedia('(max-width: 1279px)');
	const updateOverlay = () => {
		isOverlay = media.matches;
	};
	const closeOnEscape = (event: KeyboardEvent) => {
		if (event.key === 'Escape' && course) onClose();
	};
	updateOverlay();
	media.addEventListener('change', updateOverlay);
	document.addEventListener('keydown', closeOnEscape);
	return () => {
		media.removeEventListener('change', updateOverlay);
		document.removeEventListener('keydown', closeOnEscape);
	};
});

$effect(() => {
	if (!course || !isOverlay) return;
	void tick().then(() => closeButton?.focus());
});

async function navigateToPrerequisite(courseId: string): Promise<void> {
	const prerequisite = courseById.get(courseId);
	if (!prerequisite) return;
	onNavigate(prerequisite);
	await tick();
	if (content) content.scrollTop = 0;
	closeButton?.focus({ preventScroll: true });
}
</script>

{#if course}
	<button
		type="button"
		tabindex="-1"
		aria-label={m.browser_details_close()}
		class="fixed inset-0 z-40 cursor-default bg-black/45 xl:hidden"
		onclick={onClose}
	></button>
{/if}

<aside
	bind:this={panel}
	id="course-detail-panel"
	class="inset-y-0 right-0 z-50 w-full flex-col overflow-hidden border-border-primary bg-bg-secondary shadow-2xl sm:max-w-lg xl:static xl:z-auto xl:col-start-3 xl:row-start-1 xl:row-span-2 xl:flex xl:h-full xl:min-h-0 xl:w-auto xl:max-w-none xl:self-stretch xl:rounded-xl xl:border xl:shadow-none"
	class:fixed={course && isOverlay}
	class:hidden={!course}
	class:flex={course}
	role={course ? (isOverlay ? 'dialog' : 'region') : undefined}
	aria-modal={course && isOverlay ? 'true' : undefined}
	aria-labelledby={course ? TITLE_ID : undefined}
	onkeydown={handleKeydown}
>
	{#if course}
		<div bind:this={content} class="min-h-0 flex-1 overflow-y-auto">
			{#key course.id}
				<CourseDetailContent
					{course}
					{moduleType}
					titleId={TITLE_ID}
					onNavigate={navigateToPrerequisite}
					{onReviewSummary}
				>
					{#snippet close()}
						<button
							bind:this={closeButton}
							type="button"
							onclick={onClose}
							aria-label={m.browser_details_close()}
							class="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-primary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
						>
							<span class="i-lucide-x h-4 w-4" aria-hidden="true"></span>
						</button>
					{/snippet}
				</CourseDetailContent>
			{/key}
		</div>
	{:else}
		<div
			class="flex h-full flex-col items-center justify-center px-8 text-center"
		>
			<div
				class="flex h-12 w-12 items-center justify-center rounded-full border border-border-primary bg-bg-primary text-text-tertiary"
			>
				<span
					class="i-lucide-panel-right-open h-5 w-5"
					aria-hidden="true"
				></span>
			</div>
			<h2 class="mt-4 font-semibold text-text-primary">
				{m.browser_details_empty_title()}
			</h2>
			<p class="mt-1 max-w-xs text-sm leading-relaxed text-text-secondary">
				{m.browser_details_empty_text()}
			</p>
		</div>
	{/if}
</aside>
