<script lang="ts">
import {
	Background,
	Controls,
	type Edge,
	type Node,
	type NodeTargetEventWithPointer,
	SvelteFlow,
	useSvelteFlow,
	useViewport,
} from '@xyflow/svelte';
import { MediaQuery } from 'svelte/reactivity';
import * as m from '$lib/paraglide/messages';
import '@xyflow/svelte/dist/style.css';

import { getNodeWidth } from '$lib/graph/layout';
import { getEdgeStyle, getNodeStyle } from '$lib/graph/styles';
import { canvasCommands } from '$lib/stores/canvasCommands.svelte';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import { progressStore, slotStatusMap } from '$lib/stores/progressStore.svelte';
import { theme } from '$lib/stores/theme.svelte';
import {
	selectedSlotId,
	showCourseTypeBadges,
	uiStore,
} from '$lib/stores/uiStore.svelte';
import type { Course, ExtendedNodeData } from '$lib/types';
import { computePlanWarnings, computeStatuses } from '$lib/utils/status';
import AddNodeButton from './AddNodeButton.svelte';
import CustomNode from './CustomNode.svelte';
import SemesterDivider from './SemesterDivider.svelte';

const nodeTypes = {
	custom: CustomNode,
	addNode: AddNodeButton,
};

type CourseNode = Node<ExtendedNodeData, 'custom'>;

function isCourseNode(node: Node): node is CourseNode {
	return node.type === 'custom';
}

let isDragging = $state(false);
const compactScreen = new MediaQuery('(max-width: 1024px)');

const courseStore = getCourseStore();

const viewportSignal = useViewport();
const viewport = $derived(viewportSignal.current);
const { setCenter, screenToFlowPosition } = useSvelteFlow();
const semesterIndicators = $derived(courseStore.semesterDividerData);

const statuses = $derived.by(() =>
	computeStatuses(courseStore.studyPlan, slotStatusMap()),
);
const warnings = $derived(computePlanWarnings(courseStore.studyPlan));

// A removed slot or a different study plan must not leave stale details open.
$effect(() => {
	const slotId = selectedSlotId();
	if (slotId && !courseStore.studyPlan.nodes[slotId]) {
		uiStore.deselectCourse();
	}
});

const ADD_NODE_STYLE =
	'width: 80px; height: 80px; min-width: 80px; max-width: 80px;';

// The plan owns graph data. SvelteFlow may keep transient interaction state
// locally; these non-proxied projections refresh when their inputs change.
const styledNodes = $derived(
	courseStore.nodes.map((node) =>
		isCourseNode(node)
			? styleCourseNode(node)
			: { ...node, style: ADD_NODE_STYLE },
	),
);

function styleCourseNode(flowNode: CourseNode): CourseNode {
	const nodeData = flowNode.data;
	const { slot, course, isElectiveSlot } = nodeData;

	const slotStatus = slot ? progressStore.getSlotStatus(slot.id) : null;
	const nodeWarnings = warnings[flowNode.id];
	const isSelected = selectedSlotId() === flowNode.id;

	const style = getNodeStyle({
		status: statuses[flowNode.id],
		isSelected,
		isAttended: slotStatus === 'attended',
		isCompleted: slotStatus === 'completed',
		isElectiveSlot: isElectiveSlot ?? false,
		nodeWidth: nodeData.width || getNodeWidth(course?.ects || 6),
		hasSelectedCourse:
			isElectiveSlot && slot ? !!courseStore.userSelections[slot.id] : false,
		hasLaterPrerequisites: nodeData.hasLaterPrerequisites ?? false,
		...nodeWarnings,
		isDragging,
	});

	return {
		...flowNode,
		style,
		selected: isSelected,
		zIndex: isSelected ? 1000 : undefined,
		data: {
			...nodeData,
			showCourseTypeBadges: showCourseTypeBadges(),
			showRemoveButton: isSelected,
			onRemove: handleRemoveClick,
		},
	};
}

const styledEdges = $derived(
	courseStore.edges.map(
		(edge): Edge => ({
			...edge,
			...getEdgeStyle(
				edge,
				selectedSlotId(),
				statuses,
				slotStatusMap(),
				isDragging,
			),
		}),
	),
);

const handleNodeDragStart: NodeTargetEventWithPointer<
	MouseEvent | TouchEvent
> = ({ targetNode }) => {
	if (!targetNode) return;
	isDragging = true;
	courseStore.handleNodeDragStart();
};

const handleNodeDrag: NodeTargetEventWithPointer<MouseEvent | TouchEvent> = ({
	targetNode,
}) => {
	if (!targetNode) return;
	courseStore.handleNodeDrag(targetNode.id, targetNode.position);
};

const handleNodeDragStop: NodeTargetEventWithPointer<
	MouseEvent | TouchEvent
> = ({ targetNode }) => {
	isDragging = false;
	if (!targetNode) return;
	courseStore.handleNodeDragStop(targetNode.id, targetNode.position);
};

function handleNodeClick({
	node: clickedNode,
}: {
	node: Node;
	event: MouseEvent | TouchEvent;
}) {
	if (!isCourseNode(clickedNode)) return;

	const { slot, course, isElectiveSlot } = clickedNode.data;

	if (isElectiveSlot && slot) {
		const electiveCourse: Course = {
			id: slot.id,
			label:
				slot.type === 'elective'
					? m.slot_wahl()
					: slot.type === 'major'
						? m.slot_major()
						: m.slot_course(),
			ects: 0,
			prerequisites: [],
			assessmentModes: [],
			type: slot.type === 'major' ? 'Major-/Minormodul' : 'Erweiterungsmodul',
		};
		uiStore.selectCourse(electiveCourse, slot.id);
	} else if (course && slot) {
		uiStore.selectCourse(course, slot.id);
	}
}

function handleRemoveClick(nodeId: string) {
	courseStore.removeNode(nodeId);
	if (selectedSlotId() === nodeId) uiStore.deselectCourse();
}

// Canvas nodes are positioned by the viewport transform, not page scroll,
// so the tutorial pans the canvas instead of scrolling the page. setCenter
// with a duration animates the pan and resolves once the transition ends.
async function centerOnElement(element: Element) {
	const rect = element.getBoundingClientRect();
	const center = screenToFlowPosition(
		{ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
		{ snapToGrid: false },
	);
	await setCenter(center.x, center.y, {
		zoom: viewportSignal.current.zoom,
		duration: 400,
	});
}

$effect(() => {
	canvasCommands.set({ centerOnElement });
	return () => canvasCommands.set(null);
});
</script>

<div class="relative h-full min-h-0" data-tour="skill-tree">
	<SvelteFlow
		nodes={styledNodes}
		edges={styledEdges}
		{nodeTypes}
		onnodeclick={handleNodeClick}
		onnodedragstart={handleNodeDragStart}
		onnodedrag={handleNodeDrag}
		onnodedragstop={handleNodeDragStop}
		onpaneclick={() => uiStore.deselectCourse()}
		panOnScroll={true}
		zoomOnDoubleClick={false}
		nodesDraggable={true}
		nodesConnectable={false}
		deleteKey={null}
		fitView
		colorMode={theme()}
		proOptions={{ hideAttribution: compactScreen.current }}
	>
		<svg
			class="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
		>
			<g
				transform="translate({viewport.x}, {viewport.y}) scale({viewport.zoom})"
			>
				{#each semesterIndicators as divider (divider.semester)}
					<SemesterDivider
						semester={divider.semester}
						plan={courseStore.studyPlan}
						isPreview={divider.isPreview}
						length={divider.length}
					/>
				{/each}
			</g>
		</svg>
		<Controls />
		<Background gap={16} />
	</SvelteFlow>
</div>
