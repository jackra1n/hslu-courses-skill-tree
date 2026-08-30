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
import { onMount } from 'svelte';
import '@xyflow/svelte/dist/style.css';

import DisclaimerToast from '$lib/components/ui/DisclaimerToast.svelte';
import { getNodeWidth } from '$lib/graph/layout';
import { getEdgeStyle, getNodeStyle } from '$lib/graph/styles';
import { canvasCommands } from '$lib/stores/canvasCommands.svelte';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import { progressStore, slotStatusMap } from '$lib/stores/progressStore.svelte';
import { theme } from '$lib/stores/theme.svelte';
import {
	selection,
	showCourseTypeBadges,
	uiStore,
} from '$lib/stores/uiStore.svelte';
import type { Course, ExtendedNodeData } from '$lib/types';
import {
	computeStatuses,
	hasAssessmentStageViolation,
	hasMissingPrerequisites,
} from '$lib/utils/status';
import AddNodeButton from './AddNodeButton.svelte';
import CustomNode from './CustomNode.svelte';
import SemesterDivider from './SemesterDivider.svelte';

const nodeTypes = {
	custom: CustomNode,
	addNode: AddNodeButton,
};

let isDragging = $state(false);
let hideAttribution = $state(false);
let selectedNodeId = $state<string | null>(null);

const courseStore = getCourseStore();

const viewportSignal = useViewport();
const viewport = $derived(viewportSignal.current);
const { setCenter } = useSvelteFlow();
const semesterIndicators = $derived(courseStore.semesterDividerData);

const statuses = $derived.by(() =>
	computeStatuses(courseStore.studyPlan, slotStatusMap()),
);

const ADD_NODE_STYLE =
	'width: 80px; height: 80px; min-width: 80px; max-width: 80px;';

// SvelteFlow wants nodes/edges backed by $state.raw to avoid deep-proxy
// overhead, so populate the raw arrays from an effect rather than deriving.
let styledNodes = $state.raw<Node[]>([]);
$effect(() => {
	styledNodes = courseStore.nodes.map((flowNode) =>
		flowNode.type === 'addNode'
			? { ...flowNode, style: ADD_NODE_STYLE }
			: styleCourseNode(flowNode),
	);
});

function styleCourseNode(flowNode: Node) {
	const nodeData = flowNode.data as ExtendedNodeData;
	const { slot, course, isElectiveSlot } = nodeData;

	const slotStatus = slot ? progressStore.getSlotStatus(slot.id) : null;
	const hasMissingPrereqs = hasMissingPrerequisites(
		courseStore.studyPlan,
		flowNode.id,
	);
	const selected = selection();
	const isSelected =
		selected?.id === flowNode.id || (!!course && selected?.id === course.id);

	const style = getNodeStyle({
		status: statuses[flowNode.id],
		isSelected,
		isAttended: slotStatus === 'attended',
		isCompleted: slotStatus === 'completed',
		isElectiveSlot: isElectiveSlot ?? false,
		nodeWidth: nodeData.width || getNodeWidth(course?.ects || 6),
		hasSelectedCourse:
			isElectiveSlot && slot ? !!courseStore.userSelections[slot.id] : false,
		hasLaterPrerequisites: nodeData.hasLaterPrerequisites || false,
		hasMissingPrerequisites: hasMissingPrereqs,
		hasAssessmentStageViolation: hasAssessmentStageViolation(
			courseStore.studyPlan,
			flowNode.id,
		),
		isDragging,
	});

	return {
		...flowNode,
		style,
		zIndex: isSelected ? 1000 : undefined,
		data: {
			...nodeData,
			showCourseTypeBadges: showCourseTypeBadges(),
			showRemoveButton: selectedNodeId === flowNode.id,
			onRemove: handleRemoveClick,
			hasMissingPrerequisites: hasMissingPrereqs,
		},
	};
}

let styledEdges = $state.raw<Edge[]>([]);
$effect(() => {
	styledEdges = courseStore.edges.map((edge) => {
		const { style, markerEnd, animated, zIndex } = getEdgeStyle(
			edge,
			selection(),
			statuses,
			slotStatusMap(),
			courseStore.studyPlan,
			isDragging,
		);
		return { ...edge, style, markerEnd, animated, zIndex };
	});
});

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
	courseStore.handleNodeDrag(
		targetNode.id,
		targetNode.position ?? { x: 0, y: 0 },
	);
};

const handleNodeDragStop: NodeTargetEventWithPointer<
	MouseEvent | TouchEvent
> = ({ targetNode }) => {
	if (!targetNode) return;
	isDragging = false;
	courseStore.handleNodeDragStop(
		targetNode.id,
		targetNode.position ?? { x: 0, y: 0 },
	);
};

function handleNodeClick({
	node: clickedNode,
}: {
	node: Node;
	event: MouseEvent | TouchEvent;
}) {
	if (!clickedNode) return;

	// Set selected node for showing remove button
	selectedNodeId = clickedNode.id;

	const nodeData = clickedNode.data as ExtendedNodeData;
	const slot = nodeData.slot;
	const course = nodeData.course;
	const isElectiveSlot = nodeData.isElectiveSlot;

	if (isElectiveSlot && slot) {
		const electiveCourse: Course = {
			id: slot.id,
			label:
				slot.type === 'elective'
					? 'Wahl-Modul'
					: slot.type === 'major'
						? 'Major-Modul'
						: 'Course',
			ects: 0,
			prerequisites: [],
			type: slot.type === 'major' ? 'Major-/Minormodul' : 'Erweiterungsmodul',
		};
		uiStore.selectCourse(electiveCourse, slot.id);
	} else if (course && slot) {
		uiStore.selectCourse(course, slot.id);
	}
}

function handleCanvasClick() {
	// Clear selected node when clicking canvas background
	selectedNodeId = null;
}

function handleRemoveClick(nodeId: string) {
	courseStore.removeNode(nodeId);
	selectedNodeId = null;
}

// Canvas nodes are positioned by the viewport transform, not page scroll,
// so the tutorial pans the canvas instead of scrolling the page. setCenter
// with a duration animates the pan and resolves once the transition ends.
async function centerOnElement(element: Element) {
	const rect = element.getBoundingClientRect();
	const vp = viewportSignal.current;
	await setCenter(
		(rect.left + rect.width / 2 - vp.x) / vp.zoom,
		(rect.top + rect.height / 2 - vp.y) / vp.zoom,
		{ zoom: vp.zoom, duration: 400 },
	);
}

$effect(() => {
	canvasCommands.set({ centerOnElement });
	return () => canvasCommands.set(null);
});

onMount(() => {
	const mediaQuery = window.matchMedia('(max-width: 1024px)');
	const handleScreenChange = () => {
		hideAttribution = mediaQuery.matches;
	};
	handleScreenChange();
	mediaQuery.addEventListener('change', handleScreenChange);

	return () => {
		mediaQuery.removeEventListener('change', handleScreenChange);
	};
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
    onpaneclick={handleCanvasClick}
    panOnScroll={true}
    zoomOnDoubleClick={false}
    nodesDraggable={true}
    nodesConnectable={false}
    fitView
    colorMode={theme() === "system" ? "system" : theme()}
    proOptions={{ hideAttribution }}
  >
    <svg
      class="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
    >
      <g
        transform="translate({viewport.x}, {viewport.y}) scale({viewport.zoom})"
      >
        {#each semesterIndicators as divider}
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

  <DisclaimerToast />
</div>
