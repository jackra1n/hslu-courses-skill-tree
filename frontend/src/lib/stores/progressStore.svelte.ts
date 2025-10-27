import { browser } from '$app/environment';
import type { StudyPlan } from '$lib/data/study-plan';
import { resolveCourse } from '$lib/data/study-plan';
import { evaluatePrerequisites } from '$lib/utils/prerequisite';

let _slotStatus = $state(new Map<string, 'attended' | 'completed'>());
export function slotStatusMap() { return _slotStatus; }

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

  hasCompletedInstance(courseId: string, plan: StudyPlan): boolean {
    return getNodeIdsForCourse(plan, courseId).some((slotId) => _slotStatus.get(slotId) === 'completed');
  },

  hasAttendedInstance(courseId: string, plan: StudyPlan): boolean {
    const hasCurrentAttended = getNodeIdsForCourse(plan, courseId).some((slotId) => _slotStatus.get(slotId) === 'attended');
    if (hasCurrentAttended) return true;

    const potentialSlotId = courseId.toLowerCase();
    return _slotStatus.get(potentialSlotId) === 'attended';
  },

  getAllInstanceStatuses(courseId: string, plan: StudyPlan): Array<{ slotId: string, status: 'attended' | 'completed' }> {
    return getNodeIdsForCourse(plan, courseId)
      .map((slotId) => {
        const status = _slotStatus.get(slotId);
        return status ? { slotId, status } : null;
      })
      .filter((item): item is { slotId: string, status: 'attended' | 'completed' } => item !== null);
  },

  canTakeCourse(courseId: string, plan: StudyPlan): boolean {
    const course = resolveCourse(courseId);
    if (!course) return false;

    const prereqsMet = evaluatePrerequisites(course.prerequisites, _slotStatus, plan);
    const completedSlotCount = Array.from(_slotStatus.values()).filter(status => status === 'completed').length;
    const assessmentStageMet = completedSlotCount >= 6;
    const assessmentMet = !course.assessmentLevelPassed || assessmentStageMet;

    return prereqsMet && assessmentMet;
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

function getNodeIdsForCourse(plan: StudyPlan, courseId: string): string[] {
  return Object.values(plan.nodes)
    .filter((node) => node.courseId === courseId)
    .map((node) => node.id);
}
