import type { Node } from '@xyflow/svelte';
import type { ExtendedNodeData } from '$lib/data/courses';
import type { PlanRow } from '$lib/data/study-plan';
import { getNodeWidth } from './layout';

export const GRID_SIZE = { x: 40, y: 200 };
export const MAX_SEMESTERS = 12;

const ROW_START_X = GRID_SIZE.x * 2;
const DEFAULT_NODE_WIDTH = getNodeWidth(3);
const MIN_DIVIDER_NODE_COUNT = 5;
const MIN_DIVIDER_WIDTH = ROW_START_X + (DEFAULT_NODE_WIDTH + GRID_SIZE.x) * MIN_DIVIDER_NODE_COUNT;
const DIVIDER_MARGIN = GRID_SIZE.x * 2;
const DIVIDER_LINE_START = -150; // keep in sync with SemesterDivider.svelte

export function resolveNodeWidth(node: Node | undefined): number {
  if (!node) return DEFAULT_NODE_WIDTH;
  const data = node.data as ExtendedNodeData | undefined;
  return data?.width ?? DEFAULT_NODE_WIDTH;
}

// Walk a row left-to-right, invoking `visit` with each node's x offset.
// Returns the x cursor just past the last node (where the next slot sits).
function walkRow(
  nodeOrder: string[],
  widthOf: (nodeId: string) => number,
  visit?: (nodeId: string, x: number) => void
): number {
  let x = ROW_START_X;
  for (const nodeId of nodeOrder) {
    visit?.(nodeId, x);
    x += widthOf(nodeId) + GRID_SIZE.x;
  }
  return x;
}

// Position every node according to its row order. Nodes not present in any
// row keep their existing position; `skipNodeId` reserves space without moving.
export function layoutNodes(
  sourceNodes: Node[],
  rows: PlanRow[],
  options: { skipNodeId?: string } = {}
): Node[] {
  const byId = new Map(sourceNodes.map((node) => [node.id, node] as const));

  rows.forEach((row) => {
    const y = row.semester * GRID_SIZE.y;
    walkRow(
      row.nodeOrder,
      (nodeId) => resolveNodeWidth(byId.get(nodeId)),
      (nodeId, x) => {
        if (nodeId === options.skipNodeId) return;
        const node = byId.get(nodeId);
        if (node) byId.set(nodeId, { ...node, position: { x, y } });
      }
    );
  });

  return sourceNodes.map((node) => byId.get(node.id) ?? node);
}

// Append an "add module" button at the trailing edge of each semester row
// (plus one empty row beyond the last, up to MAX_SEMESTERS).
export function addAddNodeButtons(nodes: Node[], rows: PlanRow[]): Node[] {
  const byId = new Map(nodes.map((node) => [node.id, node] as const));
  const addNodes: Node[] = [];
  const semestersToShow = Math.min(rows.length + 1, MAX_SEMESTERS);

  for (let i = 0; i < semestersToShow; i++) {
    const semester = i + 1;
    const row = rows[i];
    const y = semester * GRID_SIZE.y;
    const x = row ? walkRow(row.nodeOrder, (nodeId) => resolveNodeWidth(byId.get(nodeId))) : ROW_START_X;

    addNodes.push({
      id: `add-node-${semester}`,
      type: 'addNode',
      position: { x, y },
      data: { semester },
      draggable: false,
      selectable: false,
      connectable: false,
      width: 80,
      height: 80,
      style: 'width: 80px; height: 80px;'
    });
  }

  return [...nodes, ...addNodes];
}

// Right edge of a row, honouring explicit node positions (set during a drag)
// and falling back to a cumulative cursor for nodes that aren't placed yet.
function calculateRowRightEdge(row: PlanRow, nodeLookup: Map<string, Node>): number {
  let fallbackCursor = ROW_START_X;
  let rightEdge = fallbackCursor + DEFAULT_NODE_WIDTH;

  row.nodeOrder.forEach((nodeId) => {
    const node = nodeLookup.get(nodeId);
    const width = resolveNodeWidth(node);

    if (node?.position?.x != null) {
      const end = node.position.x + width;
      rightEdge = Math.max(rightEdge, end);
      fallbackCursor = Math.max(fallbackCursor, end + GRID_SIZE.x);
      return;
    }

    const end = fallbackCursor + width;
    rightEdge = Math.max(rightEdge, end);
    fallbackCursor = end + GRID_SIZE.x;
  });

  return rightEdge;
}

// Length of the semester divider lines: long enough to clear the widest row,
// never shorter than MIN_DIVIDER_WIDTH.
export function computeDividerLength(rows: PlanRow[], nodes: Node[]): number {
  if (!rows.length) return MIN_DIVIDER_WIDTH;
  const lookup = new Map(nodes.map((node) => [node.id, node] as const));
  const longestEnd = Math.max(...rows.map((row) => calculateRowRightEdge(row, lookup)));
  const rawLength = longestEnd + DIVIDER_MARGIN - DIVIDER_LINE_START;
  return Math.max(MIN_DIVIDER_WIDTH, rawLength);
}
