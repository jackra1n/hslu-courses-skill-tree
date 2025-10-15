import type { Course, Viewport } from '../types';

// private state
let _selection = $state<Course | null>(null);
let _viewport = $state<Viewport>({ x: 0, y: 0, zoom: 1 });
let _showAssessmentInfo = $state(false);
let _showMoreOptions = $state(false);
let _showCourseTypeBadges = $state(false);
let _showProgramSelector = $state(false);

const _hasSelection = $derived(_selection !== null);

const _isElectiveSlot = $derived(
  _selection?.id.startsWith('elective') || _selection?.id.startsWith('major') || false
);

// export getter functions
export function getSelection() { return _selection; }
export function getViewport() { return _viewport; }
export function getShowAssessmentInfo() { return _showAssessmentInfo; }
export function getShowMoreOptions() { return _showMoreOptions; }
export function getShowCourseTypeBadges() { return _showCourseTypeBadges; }
export function getShowProgramSelector() { return _showProgramSelector; }
export function getHasSelection() { return _hasSelection; }
export function getIsElectiveSlot() { return _isElectiveSlot; }

export const uiStore = {
  get selection() { return _selection; },
  get viewport() { return _viewport; },
  get showAssessmentInfo() { return _showAssessmentInfo; },
  get showMoreOptions() { return _showMoreOptions; },
  get showCourseTypeBadges() { return _showCourseTypeBadges; },
  get showProgramSelector() { return _showProgramSelector; },
  get hasSelection() { return _hasSelection; },
  get isElectiveSlot() { return _isElectiveSlot; },
  
  selectCourse(course: Course | null) {
    _selection = course;
  },

  deselectCourse() {
    _selection = null;
  },

  updateViewport(newViewport: Viewport) {
    _viewport = newViewport;
  },

  toggleAssessmentInfo() {
    _showAssessmentInfo = !_showAssessmentInfo;
  },

  toggleMoreOptions() {
    _showMoreOptions = !_showMoreOptions;
  },

  toggleCourseTypeBadges() {
    _showCourseTypeBadges = !_showCourseTypeBadges;
  },

  toggleProgramSelector() {
    _showProgramSelector = !_showProgramSelector;
  }
};