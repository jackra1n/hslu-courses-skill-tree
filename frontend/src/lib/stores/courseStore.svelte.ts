import {
  AVAILABLE_TEMPLATES,
  getTemplateById,
  getTemplatesByProgram,
  getAvailablePlans,
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
import { toGraph } from '$lib/graph/build';
import { orderEdgeHandles } from '$lib/graph/edge-order';
import {
  MAX_SEMESTERS,
  layoutNodes,
  addAddNodeButtons,
  computeDividerLength
} from '$lib/graph/plan-layout';
import { progressStore, slotStatusMap } from './progressStore.svelte';
import { loadPlan, savePlan, loadLegacySelections, planPrefs } from './planStorage';
import { DragController } from './dragController.svelte';
import { canSelectCourse, isPlanCustomized } from '$lib/data/plan-rules';
import {
  seasonOfSemester,
  termOfSemester,
  formatTerm,
  planIntroYear,
  resolvePlan,
  currentStartTerm,
  type Season
} from '$lib/data/season';

const INITIAL_TERM = currentStartTerm();

type FlowNodePosition = { x: number; y: number };
type SemesterIndicator = { semester: number; isPreview: boolean; length: number };

function generateNodeId(): string {
  return `custom-${crypto.randomUUID()}`;
}

class CourseStore {
  currentTemplate = $state(AVAILABLE_TEMPLATES[0]);
  studyPlan = $state<StudyPlan>(createStudyPlan(AVAILABLE_TEMPLATES[0], {}));
  showShortNamesOnly = $state(false);
  startSeason = $state<Season>(INITIAL_TERM.season);
  startYear = $state<number>(INITIAL_TERM.year);

  private graph = $derived.by(() => toGraph(this.studyPlan, this.showShortNamesOnly));
  private positionedNodes = $derived.by(() => layoutNodes(this.graph.nodes, this.studyPlan.rows));
  private layoutedNodes = $derived.by(() => addAddNodeButtons(this.positionedNodes, this.studyPlan.rows));
  private drag = new DragController({
    layoutedNodes: () => this.layoutedNodes,
    plan: () => this.studyPlan,
    commitRows: (rows) => this.setStudyPlan({ ...this.studyPlan, rows })
  });

  userSelections = $derived(deriveSelections(this.studyPlan));
  totalCredits = $derived(calculatePlanTotalCredits(this.studyPlan));
  attendedCredits = $derived.by(() => calculateAttendedCredits(this.studyPlan, slotStatusMap()));
  completedCredits = $derived.by(() => calculateCompletedCredits(this.studyPlan, slotStatusMap()));
  calculatedTotalCredits = $derived(Math.max(0, this.totalCredits - this.attendedCredits));
  availablePlans = $derived(
    getTemplatesByProgram(this.currentTemplate.studiengang, this.currentTemplate.modell)
      .map((t) => t.plan)
      .filter((plan, index, arr) => arr.indexOf(plan) === index)
      .sort()
  );
  nodes = $derived.by(() => this.drag.activeNodes);
  edges = $derived.by(() => orderEdgeHandles(this.graph.edges, this.positionedNodes));

  semesterDividerData: SemesterIndicator[] = $derived.by(() => {
    const rows = (this.drag.previewRows ?? this.studyPlan.rows).slice(0, MAX_SEMESTERS);
    if (!rows.length) return [];

    const dividerLength = computeDividerLength(rows, this.drag.activeNodes);
    const actualCount = Math.min(this.studyPlan.rows.length, rows.length);

    return rows.map((_, index) => ({
      semester: index + 1,
      isPreview: this.drag.previewRows ? index >= actualCount : false,
      length: dividerLength
    }));
  });

  canSelectCourseForSlot(slotId: string, courseId: string): boolean {
    return canSelectCourse(this.studyPlan, slotId, courseId);
  }

  switchTemplate(templateId: string, forceReset: boolean = false) {
    const template = getTemplateById(templateId);
    if (!template) return;

    this.currentTemplate = template;
    setCoursePlan(template.plan);

    this.setStudyPlan(forceReset ? createStudyPlan(template, {}) : loadPlan(template));
    planPrefs.saveTemplate(templateId, template.plan);
  }

  switchPlan(plan: string) {
    setCoursePlan(plan);
    const nextTemplate = getTemplatesByProgram(this.currentTemplate.studiengang, this.currentTemplate.modell)
      .find((t) => t.plan === plan);
    if (nextTemplate) {
      this.switchTemplate(nextTemplate.id);
    }
  }

  selectCourseForSlot(slotId: string, courseId: string) {
    if (!this.canSelectCourseForSlot(slotId, courseId)) return;
    this.setStudyPlan(updateNodeCourse(this.studyPlan, slotId, courseId));
  }

  clearSlotSelection(slotId: string) {
    this.setStudyPlan(updateNodeCourse(this.studyPlan, slotId, null));
  }

  toggleShortNames() {
    this.showShortNamesOnly = !this.showShortNamesOnly;
    this.drag.clear();
    planPrefs.saveShortNames(this.showShortNamesOnly);
  }

  // Switch to `templateId` and record the start term that derived it. When only
  // the start term changes within the same plan, the curriculum is left intact.
  applyStart(templateId: string, year: number, season: Season, forceReset = false) {
    this.startYear = year;
    this.startSeason = season;
    planPrefs.saveStartYear(year);
    planPrefs.saveStartSeason(season);
    if (forceReset || templateId !== this.currentTemplate.id) {
      this.switchTemplate(templateId, forceReset);
    }
  }

  // The calendar season (HS/FS) a given 1-indexed plan semester falls in.
  seasonOf(semester: number): Season {
    return seasonOfSemester(semester, this.startSeason);
  }

  // The calendar term label (e.g. "FS 2026") for a 1-indexed plan semester.
  semesterLabel(semester: number): string {
    return formatTerm(termOfSemester(semester, { year: this.startYear, season: this.startSeason }));
  }

  init() {
    const savedShortNames = planPrefs.loadShortNames();
    if (savedShortNames !== null) {
      this.showShortNamesOnly = savedShortNames;
    }

    const savedTemplateId = planPrefs.loadTemplateId();
    const savedPlanCode = planPrefs.loadPlanCode();
    const savedTemplate = savedTemplateId
      ? getTemplateById(savedTemplateId)
      : savedPlanCode
        ? getTemplatesByProgram(this.currentTemplate.studiengang, this.currentTemplate.modell)
            .find((t) => t.plan === savedPlanCode)
        : undefined;

    if (savedTemplate) {
      // returning user: keep their curriculum and start term
      this.currentTemplate = savedTemplate;
      this.startSeason = planPrefs.loadStartSeason() ?? 'HS';
      this.startYear = planPrefs.loadStartYear() ?? planIntroYear(savedTemplate.plan) ?? this.startYear;
    } else {
      // new user: default to the current calendar term and derive the curriculum
      const term = currentStartTerm();
      this.startSeason = term.season;
      this.startYear = term.year;
      const plan = resolvePlan(
        getAvailablePlans(this.currentTemplate.studiengang, this.currentTemplate.modell),
        term
      );
      const template = plan
        ? getTemplatesByProgram(this.currentTemplate.studiengang, this.currentTemplate.modell)
            .find((t) => t.plan === plan)
        : undefined;
      if (template) this.currentTemplate = template;
    }

    setCoursePlan(this.currentTemplate.plan);

    const legacySelections = loadLegacySelections();
    this.setStudyPlan(loadPlan(this.currentTemplate, legacySelections));
  }

  handleNodeDragStart(nodeId: string) {
    this.drag.start(nodeId);
  }

  handleNodeDrag(nodeId: string, position: FlowNodePosition) {
    this.drag.drag(nodeId, position);
  }

  handleNodeDragStop(nodeId: string, position: FlowNodePosition) {
    this.drag.stop(nodeId, position);
  }

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

    const updatedRows = this.studyPlan.rows.map((row) => ({ ...row, nodeOrder: [...row.nodeOrder] }));
    while (updatedRows.length < semester) {
      updatedRows.push({ semester: updatedRows.length + 1, nodeOrder: [] });
    }
    updatedRows[semester - 1]?.nodeOrder.push(nodeId);

    this.setStudyPlan({
      ...this.studyPlan,
      nodes: { ...this.studyPlan.nodes, [nodeId]: newNode },
      rows: updatedRows
    });
  }

  removeNode(nodeId: string) {
    const { [nodeId]: removedNode, ...remainingNodes } = this.studyPlan.nodes;
    if (!removedNode) return;
    progressStore.clearSlotStatus(nodeId);

    const updatedRows = this.studyPlan.rows
      .map((row) => ({ ...row, nodeOrder: row.nodeOrder.filter((id) => id !== nodeId) }))
      .filter((row) => row.nodeOrder.length > 0);

    this.setStudyPlan({
      ...this.studyPlan,
      nodes: remainingNodes,
      rows: updatedRows
    });
  }

  isStudyPlanCustomized(): boolean {
    return isPlanCustomized(this.studyPlan);
  }

  private setStudyPlan(nextPlan: StudyPlan): void {
    this.studyPlan = normalizePlan(nextPlan);
    this.drag.clear();
    savePlan(this.studyPlan);
  }
}

export const courseStore = new CourseStore();
