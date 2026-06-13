import {
  AVAILABLE_TEMPLATES,
  getTemplateById,
  getTemplatesByProgram,
  setCoursePlan
} from '$lib/data/courses';
import {
  createStudyPlan,
  deriveSelections,
  updateNodeCourse,
  calculatePlanTotalCredits,
  calculateAttendedCredits,
  calculateCompletedCredits,
  normalizePlan,
  type StudyPlan,
  type PlanNode
} from '$lib/data/study-plan';
import { toGraph } from '$lib/utils/graph';
import {
  MAX_SEMESTERS,
  layoutNodes,
  addAddNodeButtons,
  computeDividerLength
} from '$lib/utils/plan-layout';
import { progressStore, slotStatusMap } from './progressStore.svelte';
import { loadPlan, savePlan, loadLegacySelections, planPrefs } from './planStorage';
import { DragController } from './dragController.svelte';
import { canSelectCourse, isPlanCustomized } from '$lib/data/plan-rules';

type FlowNodePosition = { x: number; y: number };

function generateNodeId(): string {
  return `custom-${crypto.randomUUID()}`;
}

let _currentTemplate = $state(AVAILABLE_TEMPLATES[0]);
let _selectedPlan = $state(AVAILABLE_TEMPLATES[0].plan);
let _studyPlan = $state<StudyPlan>(createStudyPlan(_currentTemplate, {}));

let _showShortNamesOnly = $state(false);

const _userSelections = $derived(deriveSelections(_studyPlan));
const _totalCredits = $derived(calculatePlanTotalCredits(_studyPlan));
const _attendedCredits = $derived.by(() => calculateAttendedCredits(_studyPlan, slotStatusMap()));
const _completedCredits = $derived.by(() => calculateCompletedCredits(_studyPlan, slotStatusMap()));
const _calculatedTotalCredits = $derived(Math.max(0, _totalCredits - _attendedCredits));
const _availablePlans = $derived(
  getTemplatesByProgram(_currentTemplate.studiengang, _currentTemplate.modell)
    .map((t) => t.plan)
    .filter((plan, index, arr) => arr.indexOf(plan) === index)
    .sort()
);
const _graph = $derived.by(() => toGraph(_studyPlan, _showShortNamesOnly));
const _layoutedNodes = $derived.by(() => {
  const layouted = layoutNodes(_graph.nodes, _studyPlan.rows);
  return addAddNodeButtons(layouted, _studyPlan.rows);
});

const drag = new DragController({
  layoutedNodes: () => _layoutedNodes,
  plan: () => _studyPlan,
  commitRows: (rows) => setStudyPlan({ ..._studyPlan, rows })
});

export function currentTemplate() { return _currentTemplate; }
export function studyPlan() { return _studyPlan; }
export function userSelections() { return _userSelections; }
export function selectedPlan() { return _selectedPlan; }
export function nodes() { return drag.activeNodes; }
export function edges() { return _graph.edges; }
export function showShortNamesOnly() { return _showShortNamesOnly; }
export function totalCredits() { return _totalCredits; }
export function attendedCredits() { return _attendedCredits; }
export function completedCredits() { return _completedCredits; }
export function calculatedTotalCredits() { return _calculatedTotalCredits; }
export function availablePlans() { return _availablePlans; }
type SemesterIndicator = { semester: number; isPreview: boolean; length: number };

export function semesterDividerData(): SemesterIndicator[] {
  const rows = (drag.previewRows ?? _studyPlan.rows).slice(0, MAX_SEMESTERS);
  if (!rows.length) return [];

  const dividerLength = computeDividerLength(rows, drag.activeNodes);
  const actualCount = Math.min(_studyPlan.rows.length, rows.length);

  return rows.map((_, index) => ({
    semester: index + 1,
    isPreview: drag.previewRows ? index >= actualCount : false,
    length: dividerLength
  }));
}

export const courseStore = {

  canSelectCourseForSlot(slotId: string, courseId: string): boolean {
    return canSelectCourse(_studyPlan, slotId, courseId);
  },

  switchTemplate(templateId: string, forceReset: boolean = false) {
    const template = getTemplateById(templateId);
    if (!template) return;

    _currentTemplate = template;
    _selectedPlan = template.plan;
    setCoursePlan(template.plan);
    
    setStudyPlan(forceReset ? createStudyPlan(template, {}) : loadPlan(template));
    planPrefs.saveTemplate(templateId, template.plan);
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
    drag.clear();
    planPrefs.saveShortNames(_showShortNamesOnly);
  },

  init() {
    const savedShortNames = planPrefs.loadShortNames();
    if (savedShortNames !== null) {
      _showShortNamesOnly = savedShortNames;
    }

    const savedTemplateId = planPrefs.loadTemplateId();
    const savedPlanCode = planPrefs.loadPlanCode();

    if (savedPlanCode) {
      _selectedPlan = savedPlanCode;
      setCoursePlan(savedPlanCode);
    }

    const savedTemplate = savedTemplateId ? getTemplateById(savedTemplateId) : undefined;
    if (savedTemplate) {
      _currentTemplate = savedTemplate;
      _selectedPlan = savedTemplate.plan;
      setCoursePlan(savedTemplate.plan);
    } else if (savedPlanCode) {
      const matchingTemplate = getTemplatesByProgram(_currentTemplate.studiengang, _currentTemplate.modell)
        .find((t) => t.plan === savedPlanCode);
      if (matchingTemplate) {
        _currentTemplate = matchingTemplate;
      }
    }

    const legacySelections = loadLegacySelections();
    setStudyPlan(loadPlan(_currentTemplate, legacySelections));
  },

  handleNodeDragStart(nodeId: string) {
    drag.start(nodeId);
  },

  handleNodeDrag(nodeId: string, position: FlowNodePosition) {
    drag.drag(nodeId, position);
  },

  handleNodeDragStop(nodeId: string, position: FlowNodePosition) {
    drag.stop(nodeId, position);
  },

  addCustomNode(semester: number) {
    const nodeId = generateNodeId();
    const newNode: PlanNode = {
      id: nodeId,
      kind: 'custom',
      slotType: 'custom',
      semester,
      courseId: null,
      ects: 0,
      label: 'Custom-Modul'
    };

    const updatedNodes = {
      ..._studyPlan.nodes,
      [nodeId]: newNode
    };

    const updatedRows = _studyPlan.rows.map((row) => ({ ...row, nodeOrder: [...row.nodeOrder] }));

    while (updatedRows.length < semester) {
      updatedRows.push({ semester: updatedRows.length + 1, nodeOrder: [] });
    }

    const targetRow = updatedRows[semester - 1];
    if (targetRow) {
      targetRow.nodeOrder.push(nodeId);
    }

    setStudyPlan({
      ..._studyPlan,
      nodes: updatedNodes,
      rows: updatedRows
    });
  },

  removeNode(nodeId: string) {
    const { [nodeId]: removedNode, ...remainingNodes } = _studyPlan.nodes;

    if (!removedNode) return;
    progressStore.clearSlotStatus(nodeId);

    const updatedRows = _studyPlan.rows
      .map((row) => ({
        ...row,
        nodeOrder: row.nodeOrder.filter((id) => id !== nodeId)
      }))
      .filter((row) => row.nodeOrder.length > 0);

    setStudyPlan({
      ..._studyPlan,
      nodes: remainingNodes,
      rows: updatedRows
    });
  },

  isStudyPlanCustomized(): boolean {
    return isPlanCustomized(_studyPlan);
  }
};

function setStudyPlan(nextPlan: StudyPlan): void {
  _studyPlan = normalizePlan(nextPlan);
  drag.clear();
  savePlan(_studyPlan);
}
