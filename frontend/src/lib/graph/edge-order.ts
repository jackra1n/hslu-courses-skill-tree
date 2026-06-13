import type { Edge, Node } from '@xyflow/svelte';
import { resolveNodeWidth } from './plan-layout';

// Reassign edge handle indices so they read left-to-right by the direction each
// edge travels. Ordering by the connected node's angle (horizontal offset over
// vertical gap) rather than its raw x keeps edges to far-away nodes central and
// pushes edges to nearby off-to-the-side nodes to the outer handles.
export function orderEdgeHandles(edges: Edge[], positionedNodes: Node[]): Edge[] {
  const centers = new Map<string, { x: number; y: number }>();
  for (const node of positionedNodes) {
    centers.set(node.id, {
      x: (node.position?.x ?? 0) + resolveNodeWidth(node) / 2,
      y: node.position?.y ?? 0
    });
  }
  const centerOf = (nodeId: string) => centers.get(nodeId) ?? { x: 0, y: 0 };

  // Angle of the edge leaving `fromId` toward `toId`, measured from vertical.
  const angle = (fromId: string, toId: string) => {
    const from = centerOf(fromId);
    const to = centerOf(toId);
    return Math.atan2(to.x - from.x, Math.abs(to.y - from.y));
  };

  const sourceHandle = assignHandles(edges, 'source', (edge) => angle(edge.source, edge.target));
  const targetHandle = assignHandles(edges, 'target', (edge) => angle(edge.target, edge.source));

  return edges.map((edge) => ({
    ...edge,
    sourceHandle: sourceHandle.get(edge.id) ?? edge.sourceHandle,
    targetHandle: targetHandle.get(edge.id) ?? edge.targetHandle
  }));
}

// Group edges by one endpoint, order each group by `keyOf`, and number the
// matching handle 0..n from left to right.
function assignHandles(
  edges: Edge[],
  endpoint: 'source' | 'target',
  keyOf: (edge: Edge) => number
): Map<string, string> {
  const groups = new Map<string, Edge[]>();
  for (const edge of edges) {
    const group = groups.get(edge[endpoint]);
    if (group) group.push(edge);
    else groups.set(edge[endpoint], [edge]);
  }

  const handleByEdge = new Map<string, string>();
  for (const group of groups.values()) {
    group.sort((a, b) => keyOf(a) - keyOf(b));
    group.forEach((edge, index) => handleByEdge.set(edge.id, `${endpoint}-${index}`));
  }
  return handleByEdge;
}
