<script lang="ts">
import { onMount, tick } from 'svelte';
import CourseDetailContent from '$lib/components/course/CourseDetailContent.svelte';
import { getCourseById } from '$lib/data/courses';
import * as m from '$lib/paraglide/messages';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import { uiStore } from '$lib/stores/uiStore.svelte';
import ActionButtons from './ActionButtons.svelte';
import ElectiveCourseSelector from './ElectiveCourseSelector.svelte';
import StatusLegend from './StatusLegend.svelte';

const TITLE_ID = 'skill-tree-course-detail-title';

let panel: HTMLElement;
let closeButton = $state<HTMLButtonElement>();
let isOverlay = $state(false);

const courseStore = getCourseStore();

const displayCourse = $derived.by(() => {
	const sel = uiStore.selection;
	if (!sel) return null;

	if (uiStore.isElectiveSlot) {
		const selectedCourseId = courseStore.userSelections[sel.id];
		if (selectedCourseId) {
			const selectedCourse = getCourseById(selectedCourseId);
			if (selectedCourse) {
				return selectedCourse;
			}
			return sel;
		}
	}

	return sel;
});

const activePlanNode = $derived.by(() => {
	const sel = uiStore.selection;
	if (!sel) return null;
	const plan = courseStore.studyPlan;
	const explicitSlot = uiStore.selectedSlotId;
	if (explicitSlot && plan.nodes[explicitSlot]) return plan.nodes[explicitSlot];
	const slotMatch = plan.nodes[sel.id];
	if (slotMatch) return slotMatch;
	return (
		Object.values(plan.nodes).find((node) => node.courseId === sel.id) ?? null
	);
});

const isDrawerOpen = $derived(uiStore.hasSelection);

function focusableElements(): HTMLElement[] {
	return Array.from(
		panel.querySelectorAll<HTMLElement>(
			'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
		),
	).filter(
		(element) => element.tabIndex >= 0 && element.getClientRects().length > 0,
	);
}

function closeDetails(): void {
	uiStore.deselectCourse();
}

async function navigateToPrerequisite(courseId: string): Promise<void> {
	const course = getCourseById(courseId);
	if (!course) return;
	const node = Object.values(courseStore.studyPlan.nodes).find(
		(node) => node.courseId === courseId,
	);
	uiStore.selectCourse(course, node?.id);
	await tick();
	panel.scrollTop = 0;
	closeButton?.focus({ preventScroll: true });
}

function handleKeydown(event: KeyboardEvent): void {
	if (!isDrawerOpen || !isOverlay) return;
	if (event.key === 'Escape') {
		event.preventDefault();
		closeDetails();
		return;
	}
	if (event.key !== 'Tab') return;

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
	updateOverlay();
	media.addEventListener('change', updateOverlay);
	return () => media.removeEventListener('change', updateOverlay);
});

$effect(() => {
	if (!displayCourse?.id) return;
	void tick().then(() => {
		panel.scrollTop = 0;
	});
});

$effect(() => {
	if (!isDrawerOpen || !isOverlay) return;
	const focusOrigin =
		document.activeElement instanceof HTMLElement &&
		document.activeElement !== document.body
			? document.activeElement
			: null;
	void tick().then(() => closeButton?.focus());
	return () => {
		if (focusOrigin?.isConnected) focusOrigin.focus();
	};
});
</script>

{#if isDrawerOpen}
	<button
		type="button"
		tabindex="-1"
		aria-label={m.details_deselect()}
		class="fixed inset-0 z-[70] cursor-default bg-black/45 xl:hidden"
		onclick={closeDetails}
	></button>
{/if}

<aside
	bind:this={panel}
	id="skill-tree-course-detail-panel"
	class={`fixed inset-y-0 right-0 z-[80] w-full overflow-y-auto border border-border-primary bg-bg-secondary shadow-2xl transition-transform duration-300 ease-out sm:max-w-lg
    ${isDrawerOpen ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'}
    xl:static xl:z-auto xl:max-w-none xl:w-full xl:border-y-0 xl:border-r-0 xl:border-l xl:translate-x-0 xl:shadow-none xl:pointer-events-auto`}
	role={isDrawerOpen ? (isOverlay ? 'dialog' : 'region') : undefined}
	aria-modal={isDrawerOpen && isOverlay ? 'true' : undefined}
	aria-labelledby={isDrawerOpen ? TITLE_ID : undefined}
	onkeydown={handleKeydown}
>
	{#if uiStore.hasSelection}
		{#if displayCourse}
			{#snippet electiveSelector()}
				<ElectiveCourseSelector slotId={uiStore.selection?.id || ''} />
			{/snippet}
			{#key `${uiStore.selection?.id}:${displayCourse.id}`}
				<CourseDetailContent
					course={displayCourse}
					moduleType={displayCourse.type}
					titleId={TITLE_ID}
					semester={activePlanNode?.semester}
					targetNodeId={activePlanNode?.id}
					elective={uiStore.isElectiveSlot && !activePlanNode?.courseId}
					selector={uiStore.isElectiveSlot ? electiveSelector : undefined}
					onNavigate={navigateToPrerequisite}
				>
					{#snippet close()}
						<button
							bind:this={closeButton}
							type="button"
							onclick={closeDetails}
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-primary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
							title={m.details_deselect()}
							aria-label={m.details_deselect()}
						>
							<span class="i-lucide-x h-4 w-4" aria-hidden="true"></span>
						</button>
					{/snippet}
					{#snippet actions()}
						{#if !uiStore.isElectiveSlot || activePlanNode?.courseId}
							<ActionButtons courseId={displayCourse.id} />
						{/if}
					{/snippet}
				</CourseDetailContent>
			{/key}
		{/if}
	{:else}
		<div class="p-6 space-y-6">
			<div class="text-center py-8">
				<div
					class="i-lucide-mouse-pointer-click w-12 h-12 mx-auto text-text-secondary mb-3"
				></div>
				<p class="text-sm text-text-secondary">
					{m.details_empty_hint()}
				</p>
				<p class="text-xs text-text-tertiary mt-2">
					{m.details_empty_elective_hint()}
				</p>
			</div>

			<div class="hidden xl:block">
				<StatusLegend />
			</div>
		</div>
	{/if}
</aside>
