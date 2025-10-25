import type { Course, Viewport } from '../types';
import { browser } from '$app/environment';

let _selection = $state<Course | null>(null);
let _selectedSlotId = $state<string | null>(null);
let _viewport = $state<Viewport>({ x: 0, y: 0, zoom: 1 });
let _showAssessmentInfo = $state(false);
let _showMoreOptions = $state(false);
let _showCourseTypeBadges = $state(false);
let _showProgramSelector = $state(false);
let _showHowToGuide = $state(false);

const _hasSelection = $derived(_selection !== null);
const _isElectiveSlot = $derived(
  _selection?.id.startsWith('elective') || _selection?.id.startsWith('major') || false
);

export function selection() { return _selection; }
export function selectedSlotId() { return _selectedSlotId; }
export function viewport() { return _viewport; }
export function showAssessmentInfo() { return _showAssessmentInfo; }
export function showMoreOptions() { return _showMoreOptions; }
export function showCourseTypeBadges() { return _showCourseTypeBadges; }
export function showProgramSelector() { return _showProgramSelector; }
export function showHowToGuide() { return _showHowToGuide; }
export function hasSelection() { return _hasSelection; }
export function isElectiveSlot() { return _isElectiveSlot; }

export const uiStore = {

  selectCourse(course: Course | null, slotId?: string | null) {
    _selection = course;
    _selectedSlotId = slotId || null;
  },

  deselectCourse() {
    _selection = null;
    _selectedSlotId = null;
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
    if (browser) {
      localStorage.setItem("showCourseTypeBadges", JSON.stringify(_showCourseTypeBadges));
    }
  },

  toggleProgramSelector() {
    _showProgramSelector = !_showProgramSelector;
  },

  toggleHowToGuide() {
    _showHowToGuide = !_showHowToGuide;
  },

  init() {
    if (!browser) return;

    const savedShowCourseTypeBadges = localStorage.getItem("showCourseTypeBadges");
    if (savedShowCourseTypeBadges) {
      _showCourseTypeBadges = JSON.parse(savedShowCourseTypeBadges);
    }
  }
};
