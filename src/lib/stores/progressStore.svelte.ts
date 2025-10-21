import { browser } from '$app/environment';
import type { Status, CurriculumTemplate } from '$lib/data/courses';
import { COURSES } from '$lib/data/courses';
import { evaluatePrerequisites } from '$lib/utils/prerequisite';
import { computeStatuses } from '$lib/utils/status';

let _slotStatus = $state(new Map<string, 'attended' | 'completed'>());

// helper functions
function saveToLocalStorage() {
  if (browser) {
    const slotStatusObj: Record<string, 'attended' | 'completed'> = {};
    _slotStatus.forEach((status, slotId) => {
      slotStatusObj[slotId] = status;
    });
    localStorage.setItem('slotStatus', JSON.stringify(slotStatusObj));
  }
}

export const progressStore = {
  get slotStatusMap() { return _slotStatus; },
  
  markSlotAttended(slotId: string) {
    const newMap = new Map(_slotStatus);
    
    if (newMap.get(slotId) === 'attended') {
      newMap.delete(slotId);
    } else {
      newMap.set(slotId, 'attended');
    }
    
    _slotStatus = newMap;
    saveToLocalStorage();
  },
  
  markSlotCompleted(slotId: string) {
    const newMap = new Map(_slotStatus);
    
    if (newMap.get(slotId) === 'completed') {
      newMap.delete(slotId);
    } else {
      newMap.set(slotId, 'completed');
    }
    
    _slotStatus = newMap;
    saveToLocalStorage();
  },
  
  clearSlotStatus(slotId: string) {
    const newMap = new Map(_slotStatus);
    newMap.delete(slotId);
    _slotStatus = newMap;
    saveToLocalStorage();
  },
  
  getSlotStatus(slotId: string): 'attended' | 'completed' | null {
    return _slotStatus.get(slotId) ?? null;
  },
  
  hasCompletedInstance(courseId: string, template: CurriculumTemplate, selections: Record<string, string>): boolean {
    const slotsWithCourse = template.slots.filter(slot => {
      if (slot.type === 'fixed') return slot.courseId === courseId;
      if (slot.type === 'elective' || slot.type === 'major') return selections[slot.id] === courseId;
      return false;
    });

    return slotsWithCourse.some(slot => _slotStatus.get(slot.id) === 'completed');
  },
  
  hasAttendedInstance(courseId: string, template: CurriculumTemplate, selections: Record<string, string>): boolean {
    const slotsWithCourse = template.slots.filter(slot => {
      if (slot.type === 'fixed') return slot.courseId === courseId;
      if (slot.type === 'elective' || slot.type === 'major') return selections[slot.id] === courseId;
      return false;
    });

    return slotsWithCourse.some(slot => _slotStatus.get(slot.id) === 'attended');
  },
  
  getAllInstanceStatuses(courseId: string, template: CurriculumTemplate, selections: Record<string, string>): Array<{slotId: string, status: 'attended' | 'completed'}> {
    const slotsWithCourse = template.slots.filter(slot => {
      if (slot.type === 'fixed') return slot.courseId === courseId;
      if (slot.type === 'elective' || slot.type === 'major') return selections[slot.id] === courseId;
      return false;
    });

    return slotsWithCourse
      .map(slot => {
        const status = _slotStatus.get(slot.id);
        return status ? { slotId: slot.id, status } : null;
      })
      .filter((item): item is {slotId: string, status: 'attended' | 'completed'} => item !== null);
  },
  
  canTakeCourse(courseId: string, template: CurriculumTemplate, selections: Record<string, string>): boolean {
    const course = COURSES.find(c => c.id === courseId);
    if (!course) return false;
    
    const prereqsMet = evaluatePrerequisites(course.prerequisites, _slotStatus, template, selections);
    const completedSlotCount = Array.from(_slotStatus.values()).filter(status => status === 'completed').length;
    const assessmentStageMet = completedSlotCount >= 6;
    const assessmentMet = !course.assessmentLevelPassed || assessmentStageMet;
    
    return prereqsMet && assessmentMet;
  },
  
  getCourseStatus(courseId: string, template: any, selections: Record<string, string>): Status {
    const statuses = computeStatuses(template, selections, _slotStatus);
    const slot = template.slots.find((s: any) => s.courseId === courseId);
    return slot ? statuses[slot.id] : "locked";
  },
  
  init() {
    if (!browser) return;

    const savedSlotStatus = localStorage.getItem('slotStatus');
    if (savedSlotStatus) {
      try {
        const slotStatusObj: Record<string, 'attended' | 'completed'> = JSON.parse(savedSlotStatus);
        _slotStatus = new Map(Object.entries(slotStatusObj));
        return;
      } catch (e) {
        console.error('Failed to parse slotStatus from localStorage', e);
      }
    }
  }
};