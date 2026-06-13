import type { Edge, Node } from '@xyflow/svelte';
import { resolveNodeWidth } from './plan-layout';

// Reassign edge handle indices so they read left-to-right: a node's leftmost
// outgoing handle connects to its leftmost target, and the same for incoming.
export function orderEdgeHandles(edges: Edge[], positionedNodes: Node[]): Edge[] {
  const centerX = new Map<string, number>();
  for (const node of positionedNodes) {
    centerX.set(node.id, (node.position?.x ?? 0) + resolveNodeWidth(node) / 2);
  }
  const at = (nodeId: string) => centerX.get(nodeId) ?? 0;

  const sourceHandle = assignHandles(edges, 'source', (edge) => at(edge.target));
  const targetHandle = assignHandles(edges, 'target', (edge) => at(edge.source));

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
