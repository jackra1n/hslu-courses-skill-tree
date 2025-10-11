import { browser } from '$app/environment';
import type { Status } from '../types';
import { COURSES, evaluateCoursePrerequisites, type UserProgress } from '../data/courses';
import { computeStatuses } from '../utils/status';

// private state
let _attended = $state(new Set<string>());
let _completed = $state(new Set<string>());

const _attendedCourses = $derived(
  COURSES.filter(course => _attended.has(course.id))
);

const _completedCourses = $derived(
  COURSES.filter(course => _completed.has(course.id))
);

const _totalAttendedCredits = $derived(
  _attendedCourses.reduce((total, course) => total + course.ects, 0)
);

const _totalCompletedCredits = $derived(
  _completedCourses.reduce((total, course) => total + course.ects, 0)
);

// export getter functions
export function getAttended() { return _attended; }
export function getCompleted() { return _completed; }
export function getAttendedCourses() { return _attendedCourses; }
export function getCompletedCourses() { return _completedCourses; }
export function getTotalAttendedCredits() { return _totalAttendedCredits; }
export function getTotalCompletedCredits() { return _totalCompletedCredits; }

// helper functions
function toggleCourseInSet(set: Set<string>, courseId: string): Set<string> {
  const newSet = new Set(set);
  if (newSet.has(courseId)) {
    newSet.delete(courseId);
  } else {
    newSet.add(courseId);
  }
  return newSet;
}

function saveToLocalStorage(key: string, set: Set<string>) {
  if (browser) {
    localStorage.setItem(key, JSON.stringify([...set]));
  }
}

function validateCourseAndPrerequisites(courseId: string): typeof COURSES[0] | null {
  const course = COURSES.find(c => c.id === courseId);
  if (!course) return null;
  
  const userProgress: UserProgress = { attended: _attended, completed: _completed };
  const prereqsMet = evaluateCoursePrerequisites(course, userProgress);
  if (!prereqsMet) return null;
  
  return course;
}

export const progressStore = {
  get attended() { return _attended; },
  get completed() { return _completed; },
  get attendedCourses() { return _attendedCourses; },
  get completedCourses() { return _completedCourses; },
  get totalAttendedCredits() { return _totalAttendedCredits; },
  get totalCompletedCredits() { return _totalCompletedCredits; },
  
  get attendedSet() { return _attended; },
  get completedSet() { return _completed; },
  
  markAttended(courseId: string) {
    const course = validateCourseAndPrerequisites(courseId);
    if (!course) return;
    
    _attended = toggleCourseInSet(_attended, courseId);
    saveToLocalStorage("attendedCourses", _attended);
  },
  
  markCompleted(courseId: string) {
    const course = validateCourseAndPrerequisites(courseId);
    if (!course) return;
    
    _completed = toggleCourseInSet(_completed, courseId);
    
    // remove from attended when marked as completed
    const newAttended = new Set(_attended);
    newAttended.delete(courseId);
    _attended = newAttended;

    saveToLocalStorage("completedCourses", _completed);
    saveToLocalStorage("attendedCourses", _attended);
  },
  
  isAttended(courseId: string): boolean {
    return _attended.has(courseId);
  },

  isCompleted(courseId: string): boolean {
    return _completed.has(courseId);
  },
  
  canTakeCourse(courseId: string): boolean {
    const course = COURSES.find(c => c.id === courseId);
    if (!course) return false;
    
    const userProgress: UserProgress = { attended: _attended, completed: _completed };
    return evaluateCoursePrerequisites(course, userProgress);
  },
  
  getCourseStatus(courseId: string, template: any, selections: Record<string, string>): Status {
    const statuses = computeStatuses(template, selections, _attended, _completed);
    const slot = template.slots.find((s: any) => s.courseId === courseId);
    return slot ? statuses[slot.id] : "locked";
  },
  
  init() {
    if (!browser) return;
    
    const savedAttended = localStorage.getItem("attendedCourses");
    if (savedAttended) {
      _attended = new Set<string>(JSON.parse(savedAttended));
    }

    const savedCompleted = localStorage.getItem("completedCourses");
    if (savedCompleted) {
      _completed = new Set<string>(JSON.parse(savedCompleted));
    }
  }
};