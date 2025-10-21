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
import { layoutSemesterBased, layoutELK, getNodeLabel } from '$lib/utils/layout';
import { progressStore } from './progressStore.svelte';

let _currentTemplate = $state(AVAILABLE_TEMPLATES[0]);
let _userSelections = $state<Record<string, string>>({});
let _selectedPlan = $state(AVAILABLE_TEMPLATES[0].plan);
let _nodes = $state<Node[]>([]);
let _edges = $state<Edge[]>([]);
let _showShortNamesOnly = $state(false);
let _useELKLayout = $state(false);

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
    
    updateGraph();
  }
};

function updateGraph() {
  const g = toGraph(_currentTemplate, _userSelections, _showShortNamesOnly);
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
        `${slot.type === 'elective' ? 'Wahl-Modul' : slot.type === 'major' ? 'Major-Modul' : 'Course'} (${selectedCourse ? (selectedCourse as Course).ects : 0} ECTS)`;
      return { ...n, data: { ...data, label, course: selectedCourse } };
    }
    
    return n;
  });
  
  _nodes = newNodes;
}
