import { browser } from '$app/environment';
import type { Node, Edge } from '@xyflow/svelte';
import type { ExtendedNodeData, Course } from '$lib/data/courses';
import {
  AVAILABLE_TEMPLATES,
  getTemplateById,
  getTemplatesByProgram,
  calculateTotalCredits,
  COURSES,
  setCoursePlan
} from '$lib/data/courses';
import { toGraph } from '$lib/utils/graph';
import { getNodeLabel, getNodeWidth } from '$lib/utils/layout';
import { progressStore } from './progressStore.svelte';

let _currentTemplate = $state(AVAILABLE_TEMPLATES[0]);
let _userSelections = $state<Record<string, string>>({});
let _selectedPlan = $state(AVAILABLE_TEMPLATES[0].plan);
let _nodes = $state<Node[]>([]);
let _edges = $state<Edge[]>([]);
let _showShortNamesOnly = $state(false);
let _useELKLayout = $state(false);
type ManualPosition = { x: number; y: number };
type FlowNodePosition = { x: number; y: number };
const GRID_SIZE = { x: 40, y: 200 };


let _activeDragNodeId: string | null = null;
let _manualPositions = $state<Record<string, ManualPosition>>({});
type SemesterOrderMap = Record<number, string[]>;
let _semesterOrders = $state<SemesterOrderMap>({});
let _slotSemesterOverrides = $state<Record<string, number>>({});

const _totalCredits = $derived(calculateTotalCredits(_currentTemplate, _userSelections));

const _availablePlans = $derived(
  getTemplatesByProgram(_currentTemplate.studiengang, _currentTemplate.modell)
    .map(t => t.plan)
    .filter((plan, index, arr) => arr.indexOf(plan) === index)
    .sort()
);

// export getter functions
export function getCurrentTemplate() { return _currentTemplate; }
export function getUserSelections() { return _userSelections; }
export function getSelectedPlan() { return _selectedPlan; }
export function getNodes() { return _nodes; }
export function getEdges() { return _edges; }
export function getShowShortNamesOnly() { return _showShortNamesOnly; }
export function getUseELKLayout() { return _useELKLayout; }
export function getTotalCredits() { return _totalCredits; }
export function getAvailablePlans() { return _availablePlans; }
export function getSemesterOrders() { return _semesterOrders; }
export function getSlotSemesterOverrides() { return _slotSemesterOverrides; }

export const courseStore = {
  get currentTemplate() { return _currentTemplate; },
  get userSelections() { return _userSelections; },
  get selectedPlan() { return _selectedPlan; },
  get nodes() { return _nodes; },
  get edges() { return _edges; },
  get showShortNamesOnly() { return _showShortNamesOnly; },
  get useELKLayout() { return _useELKLayout; },
  get totalCredits() { return _totalCredits; },
  get availablePlans() { return _availablePlans; },
  get manualPositions() { return _manualPositions; },
  get semesterOrders() { return _semesterOrders; },
  get slotSemesterOverrides() { return _slotSemesterOverrides; },
  
  canSelectCourseForSlot(slotId: string, courseId: string): boolean {
    if (progressStore.hasCompletedInstance(courseId, _currentTemplate, _userSelections)) {
      return false;
    }

    const slot = _currentTemplate.slots.find(s => s.id === slotId);
    if (!slot) {
      return false;
    }
    
    // check if this is an elective/major slot and the course is a fixed course or core/project type
    const isElectiveLike = slot.type === 'elective' || slot.type === 'major';
    if (isElectiveLike) {
      const course = COURSES.find(c => c.id === courseId);
      const appearsFixed = _currentTemplate.slots.some(s => s.type === 'fixed' && s.courseId === courseId);
      const isCoreOrProject = course?.type === 'Kernmodul' || course?.type === 'Projektmodul';
      
      if (appearsFixed || isCoreOrProject) {
        // require at least one attended instance to select in elective slot
        if (!progressStore.hasAttendedInstance(courseId, _currentTemplate, _userSelections)) {
          return false;
        }
        
        // require elective semester to be later than earliest fixed semester
        const earliestFixed = Math.min(
          ..._currentTemplate.slots
            .filter(s => s.type === 'fixed' && s.courseId === courseId)
            .map(s => s.semester)
        );
        if (Number.isFinite(earliestFixed) && slot.semester <= earliestFixed) {
          return false;
        }
      }
    }
    
    const conflictingSlotId = Object.entries(_userSelections).find(([otherSlotId, otherCourseId]) => 
      otherSlotId !== slotId && otherCourseId === courseId
    )?.[0];
    
    if (!conflictingSlotId) {
      return true;
    }
    
    // if course has attended instances, allow across semesters but only one per semester
    if (progressStore.hasAttendedInstance(courseId, _currentTemplate, _userSelections)) {
      const conflictingSlot = _currentTemplate.slots.find(s => s.id === conflictingSlotId);
      return conflictingSlot ? conflictingSlot.semester !== slot.semester : true;
    }
    return false;
  },
  
  switchTemplate(templateId: string) {
    const template = getTemplateById(templateId);
    if (!template) return;
    
    _currentTemplate = template;
    _selectedPlan = template.plan;
    _semesterOrders = loadSemesterOrders(template.id);
    _manualPositions = loadManualPositions(template.id);
    _slotSemesterOverrides = loadSemesterOverrides(template.id);
    
    if (browser) {
      localStorage.setItem("currentTemplate", templateId);
      localStorage.setItem("selectedPlan", template.plan);
    }
    
    updateGraph();
  },
  
  switchPlan(plan: string) {
    setCoursePlan(plan);
    const newTemplate = getTemplatesByProgram(_currentTemplate.studiengang, _currentTemplate.modell)
      .find(t => t.plan === plan);
    if (newTemplate) {
      this.switchTemplate(newTemplate.id);
    }
  },
  
  selectCourseForSlot(slotId: string, courseId: string) {
    if (!this.canSelectCourseForSlot(slotId, courseId)) {
      return;
    }
    
    _userSelections = { ..._userSelections, [slotId]: courseId };
    if (browser) {
      localStorage.setItem("userSelections", JSON.stringify(_userSelections));
    }
    
    updateGraph();
  },
  
  clearSlotSelection(slotId: string) {
    const newSelections = { ..._userSelections };
    delete newSelections[slotId];
    _userSelections = newSelections;
    if (browser) {
      localStorage.setItem("userSelections", JSON.stringify(_userSelections));
    }
    
    updateGraph();
  },
  
  toggleShortNames() {
    _showShortNamesOnly = !_showShortNamesOnly;
    if (browser) {
      localStorage.setItem("showShortNamesOnly", JSON.stringify(_showShortNamesOnly));
    }
    updateNodeLabels();
  },
  
  async toggleLayout() {
    _useELKLayout = !_useELKLayout;
    await updateLayout();
  },
  
  init() {
    if (!browser) return;
    
    const savedSelections = localStorage.getItem("userSelections");
    if (savedSelections) {
      _userSelections = JSON.parse(savedSelections);
    }
    
    const savedShortNames = localStorage.getItem("showShortNamesOnly");
    if (savedShortNames) {
      _showShortNamesOnly = JSON.parse(savedShortNames);
    }
    
    const savedTemplate = localStorage.getItem("currentTemplate");
    if (savedTemplate) {
      const template = getTemplateById(savedTemplate);
      if (template) {
        _currentTemplate = template;
        _selectedPlan = template.plan;
        setCoursePlan(template.plan);
        _semesterOrders = loadSemesterOrders(template.id);
        _manualPositions = loadManualPositions(template.id);
        _slotSemesterOverrides = loadSemesterOverrides(template.id);
      }
    }

    const savedPlan = localStorage.getItem("selectedPlan");
    if (savedPlan) {
      _selectedPlan = savedPlan;
      setCoursePlan(savedPlan);
      if (!savedTemplate) {
        const newTemplate = getTemplatesByProgram(_currentTemplate.studiengang, _currentTemplate.modell)
          .find(t => t.plan === savedPlan);
        if (newTemplate) {
          _currentTemplate = newTemplate;
        }
      }
    } else {
      setCoursePlan(_selectedPlan);
    }
    if (Object.keys(_semesterOrders).length === 0) {
      _semesterOrders = loadSemesterOrders(_currentTemplate.id);
    }
    if (Object.keys(_manualPositions).length === 0) {
      _manualPositions = loadManualPositions(_currentTemplate.id);
    }
    if (Object.keys(_slotSemesterOverrides).length === 0) {
      _slotSemesterOverrides = loadSemesterOverrides(_currentTemplate.id);
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
    updateNodePosition(nodeId, position, { persist: false, ensureBounds: false });
    const preview = computeReorderedSemesterOrders(nodeId, position);
    if (preview) {
      _semesterOrders = preview.orders;
      applyOrderPreview(preview.orders, nodeId);
    }
  },

  handleNodeDragStop(nodeId: string, position: FlowNodePosition) {
    updateNodePosition(nodeId, position, { persist: false, ensureBounds: false });
    const result = computeReorderedSemesterOrders(nodeId, position);
    if (result) {
      applySemesterOverride(nodeId, result.targetSemester);
      _semesterOrders = result.orders;
      saveSemesterOrders(_currentTemplate.id, _semesterOrders);
    }
    updateGraph();
    _activeDragNodeId = null;
  }
};

function updateGraph() {
  const g = toGraph(_currentTemplate, _userSelections, _showShortNamesOnly, _slotSemesterOverrides);
  _nodes = g.nodes;
  _edges = g.edges;
  cleanupSemesterOverrides(_nodes);
  saveSemesterOverrides(_currentTemplate.id, _slotSemesterOverrides);

  if (Object.keys(_semesterOrders).length === 0) {
    const derived = deriveSemesterOrdersFromManualPositions(_nodes);
    if (Object.keys(derived).length > 0) {
      _semesterOrders = derived;
    }
  }

  initializeSemesterOrders(_nodes);
  applyOrderLayout();
}

async function updateLayout() {
  applyOrderLayout();
}

function updateNodeLabels() {
  const newNodes = _nodes.map((n) => {
    const data = n.data as ExtendedNodeData;
    const slot = data.slot;
    const course = data.course;
    
    if (slot && course) {
      return { ...n, data: { ...data, label: getNodeLabel(course, _showShortNamesOnly) } };
    } else if (slot && (slot.type === "elective" || slot.type === "major")) {
      const selectedCourseId = _userSelections[slot.id];
      const selectedCourse = selectedCourseId ?
        COURSES.find((c: Course) => c.id === selectedCourseId) : null;
      const label = selectedCourse ?
        getNodeLabel(selectedCourse, _showShortNamesOnly) :
        `${slot.type === 'elective' ? 'Wahl-Modul' : slot.type === 'major' ? 'Major-Modul' : 'Course'} (${selectedCourse ? (selectedCourse as Course).ects : 0} ECTS)`;
      return { ...n, data: { ...data, label, course: selectedCourse } };
    }
    
    return n;
  });
  
  _nodes = newNodes;
}

function updateNodePosition(
  nodeId: string,
  rawPosition: FlowNodePosition,
  options: { persist: boolean; ensureBounds?: boolean }
) {
  const nodeIndex = _nodes.findIndex((n) => n.id === nodeId);
  if (nodeIndex === -1) return;

  const position = rawPosition;

  const nextNodes = _nodes.map((node, idx) => {
    if (idx !== nodeIndex) return node;
    const updatedNode: Node = {
      ...node,
      position
    };

    if ('positionAbsolute' in node) {
      (updatedNode as any).positionAbsolute = position;
    }

    return updatedNode;
  });

  _nodes = nextNodes;
  if (options.persist) {
    _manualPositions = { ..._manualPositions, [nodeId]: position };
    saveManualPositions(_currentTemplate.id, _manualPositions);
  }
}
function initializeSemesterOrders(nodes: Node[]): void {
  const updatedOrders: SemesterOrderMap = { ..._semesterOrders };
  const nodesBySemester: Record<number, Node[]> = {};

  nodes.forEach((node) => {
    const data = node.data as ExtendedNodeData;
    const slot = data?.slot;
    if (!slot) return;
    const semester = getEffectiveSemesterForNode(node);
    if (!nodesBySemester[semester]) {
      nodesBySemester[semester] = [];
    }
    nodesBySemester[semester].push(node);
  });

  Object.entries(nodesBySemester).forEach(([semesterKey, semNodes]) => {
    const semester = Number(semesterKey);
    const existingOrder = updatedOrders[semester] ?? [];
    const newOrder: string[] = [];

    existingOrder.forEach((id) => {
      if (semNodes.some((node) => node.id === id)) {
        newOrder.push(id);
      }
    });

    semNodes.forEach((node) => {
      if (!newOrder.includes(node.id)) {
        newOrder.push(node.id);
      }
    });

    updatedOrders[semester] = newOrder;
  });

  Object.keys(updatedOrders).forEach((semesterKey) => {
    const semester = Number(semesterKey);
    if (!nodesBySemester[semester]) {
      delete updatedOrders[semester];
    }
  });

  _semesterOrders = updatedOrders;
}

function deriveSemesterOrdersFromManualPositions(nodes: Node[]): SemesterOrderMap {
  if (Object.keys(_manualPositions).length === 0) {
    return {};
  }

  const orders: SemesterOrderMap = {};
  const nodesBySemester: Record<number, Node[]> = {};

  nodes.forEach((node) => {
    const data = node.data as ExtendedNodeData;
    const slot = data?.slot;
    if (!slot) return;
    const semester = getEffectiveSemesterForNode(node);
    if (!nodesBySemester[semester]) {
      nodesBySemester[semester] = [];
    }
    nodesBySemester[semester].push(node);
  });

  Object.entries(nodesBySemester).forEach(([semesterKey, semNodes]) => {
    const semester = Number(semesterKey);
    const sorted = [...semNodes].sort((a, b) => {
      const posA = _manualPositions[a.id]?.x ?? a.position?.x ?? 0;
      const posB = _manualPositions[b.id]?.x ?? b.position?.x ?? 0;
      return posA - posB;
    });
    orders[semester] = sorted.map((node) => node.id);
  });

  return orders;
}

function applyOrderLayout(): void {
  if (!_nodes.length) {
    return;
  }

  const updatedNodes = _nodes.map((node) => ({ ...node }));
  const manualPositions: Record<string, ManualPosition> = {};

  Object.entries(_semesterOrders).forEach(([semesterKey, order]) => {
    const semester = Number(semesterKey);
    let x = GRID_SIZE.x * 2;
    const y = semester * GRID_SIZE.y;

    order.forEach((nodeId) => {
      const index = updatedNodes.findIndex((n) => n.id === nodeId);
      if (index === -1) return;

      const node = updatedNodes[index];
      const data = node.data as ExtendedNodeData;
      const width = getNodeWidthForData(data);
      const position = { x, y };

      updatedNodes[index] = {
        ...node,
        position
      };

      if ('positionAbsolute' in node) {
        (updatedNodes[index] as any).positionAbsolute = position;
      }

      manualPositions[nodeId] = position;
      x += width + GRID_SIZE.x;
    });
  });

  updatedNodes.forEach((node) => {
    if (!manualPositions[node.id]) {
      if (node.position) {
        manualPositions[node.id] = node.position;
      }
    }
  });

  _nodes = updatedNodes;
  _manualPositions = manualPositions;
  saveManualPositions(_currentTemplate.id, _manualPositions);
  saveSemesterOrders(_currentTemplate.id, _semesterOrders);
  cleanupSemesterOverrides(_nodes);
  saveSemesterOverrides(_currentTemplate.id, _slotSemesterOverrides);
}

function getNodeWidthForData(data: ExtendedNodeData | undefined): number {
  if (!data) return getNodeWidth(6);
  if (data.width) return data.width;
  const course = data.course;
  if (course?.ects) {
    return getNodeWidth(course.ects);
  }
  return getNodeWidth(6);
}

function computeReorderedSemesterOrders(nodeId: string, dropPosition: FlowNodePosition): { targetSemester: number; orders: SemesterOrderMap } | null {
  const node = _nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const data = node.data as ExtendedNodeData;
  const slot = data?.slot;
  if (!slot) return null;

  const targetSemester = clampSemester(Math.max(1, Math.round(dropPosition.y / GRID_SIZE.y)));
  const updatedOrders: SemesterOrderMap = {};

  Object.entries(_semesterOrders).forEach(([semesterKey, ids]) => {
    const filtered = ids.filter((id) => id !== nodeId);
    if (filtered.length) {
      updatedOrders[Number(semesterKey)] = filtered;
    }
  });

  const targetOrderBase = [...(updatedOrders[targetSemester] ?? [])];
  const width = getNodeWidthForData(data);
  const dropCenter = dropPosition.x + width / 2;

  const siblingCenters = targetOrderBase.map((id) => {
    const siblingNode = _nodes.find((n) => n.id === id);
    if (!siblingNode) {
      return { id, center: Infinity };
    }
    const siblingData = siblingNode.data as ExtendedNodeData;
    const siblingWidth = getNodeWidthForData(siblingData);
    const x = siblingNode.position?.x ?? _manualPositions[id]?.x ?? 0;
    return { id, center: x + siblingWidth / 2 };
  });

  let insertIndex = siblingCenters.findIndex((sibling) => dropCenter < sibling.center);
  if (insertIndex === -1) {
    insertIndex = siblingCenters.length;
  }

  const nextOrder = [...targetOrderBase.slice(0, insertIndex), nodeId, ...targetOrderBase.slice(insertIndex)];
  updatedOrders[targetSemester] = nextOrder;

  return { targetSemester, orders: updatedOrders };
}

function applyOrderPreview(orders: SemesterOrderMap, draggedNodeId: string): void {
  const updatedNodes = _nodes.map((node) => ({ ...node }));

  Object.entries(orders).forEach(([semesterKey, order]) => {
    const semester = Number(semesterKey);
    let x = GRID_SIZE.x * 2;
    const y = semester * GRID_SIZE.y;

    order.forEach((nodeId) => {
      const index = updatedNodes.findIndex((n) => n.id === nodeId);
      if (index === -1) return;

      const node = updatedNodes[index];
      const data = node.data as ExtendedNodeData;
      const width = getNodeWidthForData(data);

      if (nodeId === draggedNodeId) {
        x += width + GRID_SIZE.x;
        return;
      }

      const position = { x, y };
      updatedNodes[index] = {
        ...node,
        position
      };

      if ('positionAbsolute' in node) {
        (updatedNodes[index] as any).positionAbsolute = position;
      }

      x += width + GRID_SIZE.x;
    });
  });

  _nodes = updatedNodes;
}

function loadManualPositions(templateId: string): Record<string, ManualPosition> {
  if (!browser) return {};

  try {
    const stored = localStorage.getItem(getManualPositionsKey(templateId));
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, ManualPosition>;
    return parsed || {};
  } catch (error) {
    console.error('Failed to load manual positions from localStorage', error);
    return {};
  }
}

function saveManualPositions(templateId: string, positions: Record<string, ManualPosition>): void {
  if (!browser) return;

  try {
    localStorage.setItem(getManualPositionsKey(templateId), JSON.stringify(positions));
  } catch (error) {
    console.error('Failed to save manual positions to localStorage', error);
  }
}

function getManualPositionsKey(templateId: string): string {
  return `manualPositions:${templateId}`;
}

function loadSemesterOrders(templateId: string): SemesterOrderMap {
  if (!browser) return {};

  try {
    const stored = localStorage.getItem(getSemesterOrdersKey(templateId));
    if (!stored) return {};
    const parsed = JSON.parse(stored) as SemesterOrderMap;
    return parsed || {};
  } catch (error) {
    console.error('Failed to load semester orders from localStorage', error);
    return {};
  }
}

function saveSemesterOrders(templateId: string, orders: SemesterOrderMap): void {
  if (!browser) return;

  try {
    localStorage.setItem(getSemesterOrdersKey(templateId), JSON.stringify(orders));
  } catch (error) {
    console.error('Failed to save semester orders to localStorage', error);
  }
}

function getSemesterOrdersKey(templateId: string): string {
  return `semesterOrders:${templateId}`;
}

function loadSemesterOverrides(templateId: string): Record<string, number> {
  if (!browser) return {};

  try {
    const stored = localStorage.getItem(getSemesterOverridesKey(templateId));
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, number>;
    return parsed || {};
  } catch (error) {
    console.error('Failed to load semester overrides from localStorage', error);
    return {};
  }
}

function saveSemesterOverrides(templateId: string, overrides: Record<string, number>): void {
  if (!browser) return;

  try {
    localStorage.setItem(getSemesterOverridesKey(templateId), JSON.stringify(overrides));
  } catch (error) {
    console.error('Failed to save semester overrides to localStorage', error);
  }
}

function getSemesterOverridesKey(templateId: string): string {
  return `semesterOverrides:${templateId}`;
}

function getEffectiveSemesterForNode(node: Node): number {
  const data = node.data as ExtendedNodeData;
  const slot = data?.slot;
  const override = _slotSemesterOverrides[node.id];
  const base = slot?.semester ?? 1;
  return override ?? base;
}

function applySemesterOverride(nodeId: string, semester: number): void {
  const node = _nodes.find((n) => n.id === nodeId);
  const baseSemester = (() => {
    const data = node?.data as ExtendedNodeData | undefined;
    return data?.slot?.semester ?? 1;
  })();

  const overrides = { ..._slotSemesterOverrides };
  if (semester === baseSemester) {
    if (overrides[nodeId] !== undefined) {
      delete overrides[nodeId];
    }
  } else {
    overrides[nodeId] = semester;
  }
  _slotSemesterOverrides = overrides;
  saveSemesterOverrides(_currentTemplate.id, _slotSemesterOverrides);
}

function clampSemester(semester: number): number {
  const semesters = _currentTemplate.slots.map((slot) => slot.semester);
  if (!semesters.length) {
    return Math.max(1, semester);
  }
  const maxSemester = Math.max(...semesters);
  return Math.min(Math.max(1, semester), maxSemester);
}

function cleanupSemesterOverrides(nodes: Node[]): void {
  if (Object.keys(_slotSemesterOverrides).length === 0) return;
  const validIds = new Set(nodes.map((node) => node.id));
  const overrides = { ..._slotSemesterOverrides };
  Object.keys(overrides).forEach((id) => {
    if (!validIds.has(id)) {
      delete overrides[id];
      return;
    }
    const node = nodes.find((n) => n.id === id);
    const baseSemester = (() => {
      const data = node?.data as ExtendedNodeData | undefined;
      return data?.slot?.semester ?? 1;
    })();
    if (overrides[id] === baseSemester) {
      delete overrides[id];
    }
  });
  _slotSemesterOverrides = overrides;
}
