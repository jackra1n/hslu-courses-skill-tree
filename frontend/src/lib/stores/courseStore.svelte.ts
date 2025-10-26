import { browser } from '$app/environment';
import type { Node } from '@xyflow/svelte';
import type { ExtendedNodeData, CurriculumTemplate } from '$lib/data/courses';
import {
  AVAILABLE_TEMPLATES,
  getTemplateById,
  getTemplatesByProgram,
  getCourseById,
  setCoursePlan
} from '$lib/data/courses';
import {
  createStudyPlan,
  deriveSelections,
  updateNodeCourse,
  calculatePlanTotalCredits,
  normalizePlan,
  type StudyPlan,
  type PlanRow
} from '$lib/data/study-plan';
import { toGraph } from '$lib/utils/graph';
import { getNodeWidth } from '$lib/utils/layout';
import { progressStore } from './progressStore.svelte';

type FlowNodePosition = { x: number; y: number };
const GRID_SIZE = { x: 40, y: 200 };
const MAX_SEMESTERS = 12;

let _currentTemplate = $state(AVAILABLE_TEMPLATES[0]);
let _selectedPlan = $state(AVAILABLE_TEMPLATES[0].plan);
let _studyPlan = $state<StudyPlan>(createStudyPlan(_currentTemplate, {}));

let _nodeOverride = $state.raw<Node[] | null>(null);
let _showShortNamesOnly = $state(false);
let _activeDragNodeId: string | null = null;
let _previewRows = $state<PlanRow[] | null>(null);

const _userSelections = $derived(deriveSelections(_studyPlan));
const _totalCredits = $derived(calculatePlanTotalCredits(_studyPlan));
const _availablePlans = $derived(
  getTemplatesByProgram(_currentTemplate.studiengang, _currentTemplate.modell)
    .map((t) => t.plan)
    .filter((plan, index, arr) => arr.indexOf(plan) === index)
    .sort()
);
const _graph = $derived.by(() => toGraph(_studyPlan, _showShortNamesOnly));
const _layoutedNodes = $derived.by(() => layoutNodes(_graph.nodes, _studyPlan.rows));

export function currentTemplate() { return _currentTemplate; }
export function studyPlan() { return _studyPlan; }
export function userSelections() { return _userSelections; }
export function selectedPlan() { return _selectedPlan; }
export function nodes() { return _nodeOverride ?? _layoutedNodes; }
export function edges() { return _graph.edges; }
export function showShortNamesOnly() { return _showShortNamesOnly; }
export function totalCredits() { return _totalCredits; }
export function availablePlans() { return _availablePlans; }
type SemesterIndicator = { semester: number; isPreview: boolean };

export function semesterDividerData(): SemesterIndicator[] {
  const rows = (_previewRows ?? _studyPlan.rows).slice(0, MAX_SEMESTERS);
  const actualCount = Math.min(_studyPlan.rows.length, rows.length);
  return rows.map((_, index) => ({
    semester: index + 1,
    isPreview: _previewRows ? index >= actualCount : false
  }));
}

export const courseStore = {

  canSelectCourseForSlot(slotId: string, courseId: string): boolean {
    const node = _studyPlan.nodes[slotId];
    if (!node || node.slotType === 'fixed') return false;

    if (progressStore.hasCompletedInstance(courseId, _studyPlan)) {
      return false;
    }

    const course = getCourseById(courseId);
    const appearsFixed = Object.values(_studyPlan.nodes).some(
      (planNode) => planNode.kind === 'fixed' && planNode.courseId === courseId
    );
    const isCoreOrProject = course?.type === 'Kernmodul' || course?.type === 'Projektmodul';

    if (appearsFixed || isCoreOrProject) {
      if (!progressStore.hasAttendedInstance(courseId, _studyPlan)) {
        return false;
      }

      const fixedSemesters = Object.values(_studyPlan.nodes)
        .filter((planNode) => planNode.kind === 'fixed' && planNode.courseId === courseId)
        .map((planNode) => planNode.semester);

      if (fixedSemesters.length > 0) {
        const earliestFixed = Math.min(...fixedSemesters);
        if (node.semester <= earliestFixed) {
          return false;
        }
      }
    }

    const conflictingSlotId = Object.entries(_userSelections).find(
      ([otherSlotId, otherCourseId]) => otherSlotId !== slotId && otherCourseId === courseId
    )?.[0];

    if (!conflictingSlotId) {
      return true;
    }

    if (progressStore.hasAttendedInstance(courseId, _studyPlan)) {
      const conflictingNode = _studyPlan.nodes[conflictingSlotId];
      return conflictingNode ? conflictingNode.semester !== node.semester : true;
    }

    return false;
  },

  switchTemplate(templateId: string) {
    const template = getTemplateById(templateId);
    if (!template) return;

    _currentTemplate = template;
    _selectedPlan = template.plan;
    setCoursePlan(template.plan);
    setStudyPlan(loadStoredPlan(template));

    if (browser) {
      localStorage.setItem('currentTemplate', templateId);
      localStorage.setItem('selectedPlan', template.plan);
    }

  },

  switchPlan(plan: string) {
    setCoursePlan(plan);
    const nextTemplate = getTemplatesByProgram(_currentTemplate.studiengang, _currentTemplate.modell)
      .find((t) => t.plan === plan);
    if (nextTemplate) {
      this.switchTemplate(nextTemplate.id);
    }
  },

  selectCourseForSlot(slotId: string, courseId: string) {
    if (!this.canSelectCourseForSlot(slotId, courseId)) return;
    setStudyPlan(updateNodeCourse(_studyPlan, slotId, courseId));
  },

  clearSlotSelection(slotId: string) {
    setStudyPlan(updateNodeCourse(_studyPlan, slotId, null));
  },

  toggleShortNames() {
    _showShortNamesOnly = !_showShortNamesOnly;
    clearNodeOverride();
    if (browser) {
      localStorage.setItem('showShortNamesOnly', JSON.stringify(_showShortNamesOnly));
    }
  },

  init() {
    if (browser) {
      const savedShortNames = localStorage.getItem('showShortNamesOnly');
      if (savedShortNames) {
        _showShortNamesOnly = JSON.parse(savedShortNames);
      }

      const savedTemplateId = localStorage.getItem('currentTemplate');
      const savedPlanCode = localStorage.getItem('selectedPlan');

      if (savedPlanCode) {
        _selectedPlan = savedPlanCode;
        setCoursePlan(savedPlanCode);
      }

      if (savedTemplateId) {
        const template = getTemplateById(savedTemplateId);
        if (template) {
          _currentTemplate = template;
          _selectedPlan = template.plan;
          setCoursePlan(template.plan);
        }
      } else if (savedPlanCode) {
        const matchingTemplate = getTemplatesByProgram(_currentTemplate.studiengang, _currentTemplate.modell)
          .find((t) => t.plan === savedPlanCode);
        if (matchingTemplate) {
          _currentTemplate = matchingTemplate;
        }
      }

      const legacySelections = loadLegacySelections();
      const storedPlan = loadStoredPlan(_currentTemplate, legacySelections);
      setStudyPlan(storedPlan);
    }

  },

  handleNodeDragStart(nodeId: string) {
    _activeDragNodeId = nodeId;
    _previewRows = null;
    ensureNodeOverride();
  },

  handleNodeDrag(nodeId: string, position: FlowNodePosition) {
    if (_activeDragNodeId !== nodeId) {
      _activeDragNodeId = nodeId;
    }
    applyDirectNodePosition(nodeId, position);
    const preview = computeRowPreview(nodeId, position, getActiveNodes());
    if (preview) {
      _previewRows = preview.rows;
      _nodeOverride = layoutNodes(getActiveNodes(), preview.rows, { skipNodeId: nodeId });
    } else {
      _previewRows = null;
    }
  },

  handleNodeDragStop(nodeId: string, position: FlowNodePosition) {
    const result = computeRowPreview(nodeId, position, getActiveNodes());
    if (result) {
      setStudyPlan({ ..._studyPlan, rows: result.rows });
    }
    clearNodeOverride();
    _activeDragNodeId = null;
  }
};

function layoutNodes(
  sourceNodes: Node[],
  rows: PlanRow[],
  options: { skipNodeId?: string } = {}
): Node[] {
  const updated = sourceNodes.map((node) => ({ ...node }));

  rows.forEach((row) => {
    let x = GRID_SIZE.x * 2;
    const y = row.semester * GRID_SIZE.y;
    const placed = new Set<string>();

    row.nodeOrder.forEach((nodeId) => {
      if (placed.has(nodeId)) {
        return;
      }
      const index = updated.findIndex((n) => n.id === nodeId);
      if (index === -1) return;

      const node = updated[index];
      const data = node.data as ExtendedNodeData | undefined;
      const width = data?.width ?? getNodeWidth(3);

      if (options.skipNodeId && nodeId === options.skipNodeId) {
        x += width + GRID_SIZE.x;
        return;
      }

      const position = { x, y };
      updated[index] = {
        ...node,
        position
      };
      if ('positionAbsolute' in node) {
        (updated[index] as any).positionAbsolute = position;
      }
      placed.add(nodeId);
      x += width + GRID_SIZE.x;
    });
  });

  return updated;
}

function applyDirectNodePosition(nodeId: string, position: FlowNodePosition): void {
  const nodes = ensureNodeOverride();
  let changed = false;
  const updated = nodes.map((node) => {
    if (node.id !== nodeId) return node;
    changed = true;
    const next: Node = { ...node, position };
    if ('positionAbsolute' in node) {
      (next as any).positionAbsolute = position;
    }
    return next;
  });
  if (changed) {
    _nodeOverride = updated;
  }
}

function computeRowPreview(
  nodeId: string,
  dropPosition: FlowNodePosition,
  nodesSnapshot: Node[]
): { rows: PlanRow[] } | null {
  if (!_studyPlan.rows.length) return null;

  const desiredSemester = Math.max(1, Math.round(dropPosition.y / GRID_SIZE.y));
  const targetSemester = Math.min(MAX_SEMESTERS, desiredSemester);
  const rows = _studyPlan.rows.map((row) => ({
    semester: row.semester,
    nodeOrder: row.nodeOrder.filter((id) => id !== nodeId)
  }));

  while (rows.length < targetSemester) {
    rows.push({ semester: rows.length + 1, nodeOrder: [] });
  }

  const targetRow = rows[targetSemester - 1];
  if (!targetRow) return null;

  const node = nodesSnapshot.find((n) => n.id === nodeId);
  if (!node) return null;
  const data = node?.data as ExtendedNodeData | undefined;
  const nodeWidth = data?.width ?? getNodeWidth(3);
  const dropCenter = dropPosition.x + nodeWidth / 2;

  const siblingCenters = targetRow.nodeOrder.map((id) => {
    const siblingNode = nodesSnapshot.find((n) => n.id === id);
    const siblingData = siblingNode?.data as ExtendedNodeData | undefined;
    const siblingWidth = siblingData?.width ?? getNodeWidth(3);
    const center = (siblingNode?.position?.x ?? 0) + siblingWidth / 2;
    return { id, center };
  });

  let insertIndex = siblingCenters.findIndex((sibling) => dropCenter < sibling.center);
  if (insertIndex === -1) insertIndex = siblingCenters.length;

  targetRow.nodeOrder = [
    ...targetRow.nodeOrder.slice(0, insertIndex),
    nodeId,
    ...targetRow.nodeOrder.slice(insertIndex)
  ];

  return { rows: normalizeRows(rows) };
}

function normalizeRows(rows: PlanRow[]): PlanRow[] {
  const normalized = rows.map((row) => ({
    semester: row.semester,
    nodeOrder: [...row.nodeOrder]
  }));

  while (normalized.length > 1 && normalized[normalized.length - 1].nodeOrder.length === 0) {
    normalized.pop();
  }

  return normalized.map((row, index) => ({
    semester: index + 1,
    nodeOrder: [...row.nodeOrder]
  }));
}

function setStudyPlan(nextPlan: StudyPlan): void {
  _studyPlan = normalizePlan(nextPlan);
  clearNodeOverride();
  saveStudyPlan(_studyPlan);
}

function getPlanStorageKey(templateId: string): string {
  return `studyPlan:${templateId}`;
}

function saveStudyPlan(plan: StudyPlan): void {
  if (!browser) return;
  try {
    localStorage.setItem(getPlanStorageKey(plan.templateId), JSON.stringify(plan));
  } catch (error) {
    console.error('Failed to persist study plan', error);
  }
}

function loadStoredPlan(template: CurriculumTemplate, fallbackSelections: Record<string, string> = {}): StudyPlan {
  if (!browser) {
    return createStudyPlan(template, fallbackSelections);
  }

  const stored = localStorage.getItem(getPlanStorageKey(template.id));
  if (stored) {
    try {
      const parsed = normalizePlan(JSON.parse(stored) as StudyPlan);
      if (isPlanCompatible(parsed, template)) {
        return parsed;
      }
    } catch (error) {
      console.error('Failed to parse stored study plan', error);
    }
  }

  return createStudyPlan(template, fallbackSelections);
}

function isPlanCompatible(plan: StudyPlan, template: CurriculumTemplate): boolean {
  if (plan.templateId !== template.id) return false;
  const templateIds = new Set(template.slots.map((slot) => slot.id));
  const planNodeIds = Object.keys(plan.nodes);
  if (templateIds.size !== planNodeIds.length) return false;
  if (!planNodeIds.every((id) => templateIds.has(id))) return false;

  const rowNodeCount = plan.rows.reduce((count, row) => count + row.nodeOrder.length, 0);
  return rowNodeCount === planNodeIds.length;
}

function loadLegacySelections(): Record<string, string> {
  if (!browser) return {};
  const stored = localStorage.getItem('userSelections');
  if (!stored) return {};

  try {
    const selections = JSON.parse(stored) as Record<string, string>;
    localStorage.removeItem('userSelections');
    return selections || {};
  } catch (error) {
    console.error('Failed to parse legacy user selections', error);
    return {};
  }
}

function getActiveNodes(): Node[] {
  return _nodeOverride ?? _layoutedNodes;
}

function ensureNodeOverride(): Node[] {
  if (_nodeOverride) return _nodeOverride;
  const cloned = cloneNodes(_layoutedNodes);
  _nodeOverride = cloned;
  return cloned;
}

function cloneNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    const cloned: Node = {
      ...node,
      position: node.position ? { ...node.position } : node.position
    };
    if ('positionAbsolute' in node && (node as any).positionAbsolute) {
      (cloned as any).positionAbsolute = { ...(node as any).positionAbsolute };
    }
    return cloned;
  });
}

function clearNodeOverride(): void {
  _nodeOverride = null;
  _previewRows = null;
}
