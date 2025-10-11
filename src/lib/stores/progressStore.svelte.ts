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
    const course = COURSES.find(c => c.id === courseId);
    if (!course) return;
    
    const userProgress: UserProgress = { attended: _attended, completed: _completed };
    const prereqsMet = evaluateCoursePrerequisites(course, userProgress);
    if (!prereqsMet) return;
    
    const newAttended = new Set(_attended);
    if (newAttended.has(course.id)) {
      newAttended.delete(course.id);
    } else {
      newAttended.add(course.id);
    }

    _attended = newAttended;

    if (browser) {
      localStorage.setItem("attendedCourses", JSON.stringify([..._attended]));
    }
  },
  
  markCompleted(courseId: string) {
    const course = COURSES.find(c => c.id === courseId);
    if (!course) return;
    
    const newCompleted = new Set(_completed);
    if (newCompleted.has(course.id)) {
      newCompleted.delete(course.id);
    } else {
      newCompleted.add(course.id);
    }

    _completed = newCompleted;

    const newAttended = new Set(_attended);
    newAttended.delete(course.id);
    _attended = newAttended;

    if (browser) {
      localStorage.setItem("completedCourses", JSON.stringify([..._completed]));
      localStorage.setItem("attendedCourses", JSON.stringify([..._attended]));
    }
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