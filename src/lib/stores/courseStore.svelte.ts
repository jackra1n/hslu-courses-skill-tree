import { browser } from '$app/environment';
import type { Node, Edge } from '@xyflow/svelte';
import type { Course, ExtendedNodeData } from '../types';
import {
  AVAILABLE_TEMPLATES,
  getTemplateById,
  getTemplatesByProgram,
  calculateTotalCredits,
  COURSES
} from '../data/courses';
import { toGraph } from '../utils/graph';
import { layoutSemesterBased, layoutELK, getNodeLabel } from '../utils/layout';
import { progressStore } from './progressStore.svelte';

// private state - not exported directly
let _currentTemplate = $state(AVAILABLE_TEMPLATES[0]);
let _userSelections = $state<Record<string, string>>({});
let _selectedPlan = $state(AVAILABLE_TEMPLATES[0].plan);
let _nodes = $state<Node[]>([]);
let _edges = $state<Edge[]>([]);
let _showShortNamesOnly = $state(false);
let _useELKLayout = $state(false);

// derived values
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
  
  canSelectCourseForSlot(slotId: string, courseId: string): boolean {
    if (progressStore.isCompleted(courseId)) {
      return false;
    }

    const slot = _currentTemplate.slots.find(s => s.id === slotId);
    if (!slot) {
      return false;
    }
    
    const conflictingSlotId = Object.entries(_userSelections).find(([otherSlotId, otherCourseId]) => 
      otherSlotId !== slotId && otherCourseId === courseId
    )?.[0];
    
    if (!conflictingSlotId) {
      return true;
    }
    
    // if course is attended (failed) allow across semesters but only one per semester
    if (progressStore.isAttended(courseId)) {
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
    
    if (browser) {
      localStorage.setItem("currentTemplate", templateId);
      localStorage.setItem("selectedPlan", template.plan);
    }
    
    updateGraph();
  },
  
  switchPlan(plan: string) {
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
    
    const savedTemplate = localStorage.getItem("currentTemplate");
    if (savedTemplate) {
      const template = getTemplateById(savedTemplate);
      if (template) {
        _currentTemplate = template;
        _selectedPlan = template.plan;
      }
    }

    const savedPlan = localStorage.getItem("selectedPlan");
    if (savedPlan) {
      _selectedPlan = savedPlan;
      if (!savedTemplate) {
        const newTemplate = getTemplatesByProgram(_currentTemplate.studiengang, _currentTemplate.modell)
          .find(t => t.plan === savedPlan);
        if (newTemplate) {
          _currentTemplate = newTemplate;
        }
      }
    }
    
    updateGraph();
  }
};

function updateGraph() {
  const g = toGraph(_currentTemplate, _userSelections);
  _nodes = g.nodes;
  _edges = g.edges;
  updateLayout();
}

async function updateLayout() {
  if (_useELKLayout) {
    try {
      const newNodes = await layoutELK(_nodes);
      _nodes = newNodes;
    } catch (error) {
      console.error("ELK layout failed, falling back to semester layout:", error);
      _useELKLayout = false;
      const newNodes = layoutSemesterBased(_currentTemplate, _userSelections, _nodes);
      _nodes = newNodes;
    }
  } else {
    const newNodes = layoutSemesterBased(_currentTemplate, _userSelections, _nodes);
    _nodes = newNodes;
  }
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
        `${slot.label} (${slot.credits} ECTS)`;
      return { ...n, data: { ...data, label, course: selectedCourse } };
    }
    
    return n;
  });
  
  _nodes = newNodes;
}
