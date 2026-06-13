import type { Node } from '@xyflow/svelte';
import type { ExtendedNodeData } from '$lib/data/courses';
import type { PlanRow, StudyPlan } from '$lib/data/study-plan';
import { getNodeWidth } from '$lib/utils/layout';
import { GRID_SIZE, MAX_SEMESTERS, layoutNodes } from '$lib/utils/plan-layout';

type Position = { x: number; y: number };

type DragDeps = {
  layoutedNodes: () => Node[];
  plan: () => StudyPlan;
  commitRows: (rows: PlanRow[]) => void;
};

export class DragController {
  previewRows = $state<PlanRow[] | null>(null);

  private override = $state.raw<Node[] | null>(null);
  private activeNodeId: string | null = null;
  private readonly deps: DragDeps;

  constructor(deps: DragDeps) {
    this.deps = deps;
  }

  get activeNodes(): Node[] {
    return this.override ?? this.deps.layoutedNodes();
  }

  start(nodeId: string): void {
    this.activeNodeId = nodeId;
    this.previewRows = null;
    this.ensureOverride();
  }

  drag(nodeId: string, position: Position): void {
    this.activeNodeId = nodeId;
    this.applyDirectPosition(nodeId, position);

    const preview = this.computeRowPreview(nodeId, position);
    if (preview) {
      this.previewRows = preview;
      this.override = layoutNodes(this.activeNodes, preview, { skipNodeId: nodeId });
    } else {
      this.previewRows = null;
    }
  }

  stop(nodeId: string, position: Position): void {
    const preview = this.computeRowPreview(nodeId, position);
    if (preview) this.deps.commitRows(preview);
    this.clear();
    this.activeNodeId = null;
  }

  clear(): void {
    this.override = null;
    this.previewRows = null;
  }

  private ensureOverride(): Node[] {
    if (this.override) return this.override;
    const cloned = this.deps.layoutedNodes().map((node) => ({
      ...node,
      position: node.position ? { ...node.position } : node.position
    }));
    this.override = cloned;
    return cloned;
  }

  private applyDirectPosition(nodeId: string, position: Position): void {
    const nodes = this.ensureOverride();
    let changed = false;
    const updated = nodes.map((node) => {
      if (node.id !== nodeId) return node;
      changed = true;
      return { ...node, position };
    });
    if (changed) this.override = updated;
  }

  // Row arrangement a drop would produce, inserting by horizontal center.
  private computeRowPreview(nodeId: string, dropPosition: Position): PlanRow[] | null {
    const plan = this.deps.plan();
    if (!plan.rows.length) return null;

    const desiredSemester = Math.max(1, Math.round(dropPosition.y / GRID_SIZE.y));
    const targetSemester = Math.min(MAX_SEMESTERS, desiredSemester);
    const rows = plan.rows.map((row) => ({
      semester: row.semester,
      nodeOrder: row.nodeOrder.filter((id) => id !== nodeId)
    }));

    while (rows.length < targetSemester) {
      rows.push({ semester: rows.length + 1, nodeOrder: [] });
    }

    const targetRow = rows[targetSemester - 1];
    if (!targetRow) return null;

    const snapshot = this.activeNodes;
    const node = snapshot.find((n) => n.id === nodeId);
    if (!node) return null;
    const nodeWidth = widthOf(node);
    const dropCenter = dropPosition.x + nodeWidth / 2;

    const insertIndex = targetRow.nodeOrder.findIndex((id) => {
      const sibling = snapshot.find((n) => n.id === id);
      const center = (sibling?.position?.x ?? 0) + widthOf(sibling) / 2;
      return dropCenter < center;
    });

    const at = insertIndex === -1 ? targetRow.nodeOrder.length : insertIndex;
    targetRow.nodeOrder = [
      ...targetRow.nodeOrder.slice(0, at),
      nodeId,
      ...targetRow.nodeOrder.slice(at)
    ];

    return normalizeRows(rows);
  }
}

function widthOf(node: Node | undefined): number {
  const data = node?.data as ExtendedNodeData | undefined;
  return data?.width ?? getNodeWidth(3);
}

function normalizeRows(rows: PlanRow[]): PlanRow[] {
  const normalized = rows.map((row) => ({ ...row, nodeOrder: [...row.nodeOrder] }));

  while (normalized.length > 1 && normalized[normalized.length - 1].nodeOrder.length === 0) {
    normalized.pop();
  }

  return normalized.map((row, index) => ({
    semester: index + 1,
    nodeOrder: row.nodeOrder
  }));
}
