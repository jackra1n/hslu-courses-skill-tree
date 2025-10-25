import { browser } from '$app/environment';
import type { Node, Edge } from '@xyflow/svelte';
import type { ExtendedNodeData, Course, CurriculumTemplate } from '$lib/data/courses';
import {
  AVAILABLE_TEMPLATES,
  getTemplateById,
  getTemplatesByProgram,
  COURSES,
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

let _currentTemplate = $state(AVAILABLE_TEMPLATES[0]);
let _selectedPlan = $state(AVAILABLE_TEMPLATES[0].plan);
let _studyPlan = $state<StudyPlan>(createStudyPlan(_currentTemplate, {}));

let _nodes = $state.raw<Node[]>([]);
let _edges = $state.raw<Edge[]>([]);
let _showShortNamesOnly = $state(false);
let _activeDragNodeId: string | null = null;

const _userSelections = $derived(deriveSelections(_studyPlan));
const _totalCredits = $derived(calculatePlanTotalCredits(_studyPlan));
const _availablePlans = $derived(
  getTemplatesByProgram(_currentTemplate.studiengang, _currentTemplate.modell)
    .map((t) => t.plan)
    .filter((plan, index, arr) => arr.indexOf(plan) === index)
    .sort()
);

export function currentTemplate() { return _currentTemplate; }
export function studyPlan() { return _studyPlan; }
export function userSelections() { return _userSelections; }
export function selectedPlan() { return _selectedPlan; }
export function nodes() { return _nodes; }
export function edges() { return _edges; }
export function showShortNamesOnly() { return _showShortNamesOnly; }
export function totalCredits() { return _totalCredits; }
export function availablePlans() { return _availablePlans; }

export const courseStore = {

  canSelectCourseForSlot(slotId: string, courseId: string): boolean {
    const node = _studyPlan.nodes[slotId];
    if (!node || node.slotType === 'fixed') return false;

    if (progressStore.hasCompletedInstance(courseId, _studyPlan)) {
      return false;
    }

    const course = COURSES.find((c) => c.id === courseId);
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

    updateGraph();
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
    updateGraph();
  },

  clearSlotSelection(slotId: string) {
    setStudyPlan(updateNodeCourse(_studyPlan, slotId, null));
    updateGraph();
  },

  toggleShortNames() {
    _showShortNamesOnly = !_showShortNamesOnly;
    if (browser) {
      localStorage.setItem('showShortNamesOnly', JSON.stringify(_showShortNamesOnly));
    }
    updateGraph();
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

    updateGraph();
  },

  handleNodeDragStart(nodeId: string) {
    _activeDragNodeId = nodeId;
  },

  handleNodeDrag(nodeId: string, position: FlowNodePosition) {
    if (_activeDragNodeId !== nodeId) {
      _activeDragNodeId = nodeId;
    }
    const preview = computeRowPreview(nodeId, position);
    if (preview) {
      _nodes = layoutNodes(_nodes, preview.rows, { skipNodeId: nodeId });
    }
  },

  handleNodeDragStop(nodeId: string, position: FlowNodePosition) {
    const result = computeRowPreview(nodeId, position);
    if (result) {
      setStudyPlan({ ..._studyPlan, rows: result.rows });
      updateGraph();
    } else {
      updateGraph();
    }
    _activeDragNodeId = null;
  }
};

function updateGraph(): void {
  _studyPlan = normalizePlan(_studyPlan);
  const graph = toGraph(_studyPlan, _showShortNamesOnly);
  _nodes = layoutNodes(graph.nodes, _studyPlan.rows);
  _edges = graph.edges;
}

function layoutNodes(
  sourceNodes: Node[],
  rows: PlanRow[],
  options: { skipNodeId?: string } = {}
): Node[] {
  const updated = sourceNodes.map((node) => ({ ...node }));

  rows.forEach((row) => {
    let x = GRID_SIZE.x * 2;
    const y = row.semester * GRID_SIZE.y;

    row.nodeOrder.forEach((nodeId) => {
      const index = updated.findIndex((n) => n.id === nodeId);
      if (index === -1) return;

      const node = updated[index];
      const data = node.data as ExtendedNodeData | undefined;
      const width = getNodeWidthForData(data);

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
      x += width + GRID_SIZE.x;
    });
  });

  return updated;
}

function getNodeWidthForData(data?: ExtendedNodeData): number {
  if (!data) return getNodeWidth(6);
  const course = data.course as Course | undefined;
  const ects = course?.ects ?? 6;
  return getNodeWidth(Math.max(ects, 3));
}

function computeRowPreview(nodeId: string, dropPosition: FlowNodePosition): { rows: PlanRow[] } | null {
  if (!_studyPlan.rows.length) return null;

  const targetSemester = clampSemester(Math.max(1, Math.round(dropPosition.y / GRID_SIZE.y)));
  const targetIndex = targetSemester - 1;
  const rows = _studyPlan.rows.map((row) => ({
    semester: row.semester,
    nodeOrder: row.nodeOrder.filter((id) => id !== nodeId)
  }));

  const targetRow = rows[targetIndex];
  if (!targetRow) return null;

  const node = _nodes.find((n) => n.id === nodeId);
  const data = node?.data as ExtendedNodeData | undefined;
  const nodeWidth = getNodeWidthForData(data);
  const dropCenter = dropPosition.x + nodeWidth / 2;

  const siblingCenters = targetRow.nodeOrder.map((id) => {
    const siblingNode = _nodes.find((n) => n.id === id);
    const siblingData = siblingNode?.data as ExtendedNodeData | undefined;
    const siblingWidth = getNodeWidthForData(siblingData);
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

  return { rows };
}

function clampSemester(semester: number): number {
  const maxSemester = _studyPlan.rows.length;
  if (maxSemester === 0) return 1;
  return Math.min(Math.max(semester, 1), maxSemester);
}

function setStudyPlan(nextPlan: StudyPlan): void {
  _studyPlan = normalizePlan(nextPlan);
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
