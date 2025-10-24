import type { 
  Course,
  PrerequisiteRule
} from '$lib/data/courses';
import { 
  COURSES
} from '$lib/data/courses';
import type { TemplateSlot, CurriculumTemplate } from '$lib/data/courses';
import { TemplateIndex } from '$lib/utils/template-index';

export function evaluatePrerequisiteRule(
  rule: PrerequisiteRule,
  slotStatus: Map<string, 'attended' | 'completed'>,
  template: CurriculumTemplate,
  selections: Record<string, string>
): boolean {
  const modules = rule.modules;

  const moduleResults = modules.map(moduleId => {
    const slotsWithCourse = template.slots.filter(slot => {
      if (slot.type === 'fixed') return slot.courseId === moduleId;
      if (slot.type === 'elective' || slot.type === 'major') return selections[slot.id] === moduleId;
      return false;
    });

    return slotsWithCourse.some(slot => {
      const status = slotStatus.get(slot.id);
      if (rule.mustBePassed) {
        return status === 'completed';
      } else {
        return status === 'attended' || status === 'completed';
      }
    });
  });
  
  if (rule.moduleLinkType === 'oder') {
    return moduleResults.some(result => result);
  } else {
    return moduleResults.every(result => result);
  }
}

export function evaluatePrerequisites(
  rules: PrerequisiteRule[],
  slotStatus: Map<string, 'attended' | 'completed'>,
  template: CurriculumTemplate,
  selections: Record<string, string>
): boolean {
  if (rules.length === 0) return true;
  
  return rules.reduce((acc, rule, index) => {
    const currentResult = evaluatePrerequisiteRule(rule, slotStatus, template, selections);
    
    if (index === 0) {
      return currentResult;
    }
    
    const prevRule = rules[index - 1];
    const linkType = prevRule.prerequisiteLinkType || 'und';
    
    return linkType === 'oder' ? acc || currentResult : acc && currentResult;
  }, false);
}

function ruleSatisfiedBefore(rule: PrerequisiteRule, dependentSlotId: string, index: TemplateIndex, considerSameSemester: boolean): boolean {
  const dependentSemester = index.getSemesterBySlotId(dependentSlotId);
  if (dependentSemester === undefined) return false;

  const moduleResults = rule.modules.map(moduleId => {
    const providerSlots = considerSameSemester 
      ? index.providerSlotsFor(moduleId).filter(slot => slot.semester <= dependentSemester)
      : index.providerSlotsFor(moduleId).filter(slot => slot.semester < dependentSemester);
    return providerSlots.length > 0;
  });

  if (rule.moduleLinkType === 'oder') {
    return moduleResults.some(result => result);
  } else {
    return moduleResults.every(result => result);
  }
}

function evaluatePrerequisitesSchedulableBefore(
  rules: PrerequisiteRule[],
  dependentSlotId: string,
  index: TemplateIndex,
  considerSameSemester: boolean
): boolean {
  if (rules.length === 0) return true;
  
  return rules.reduce((acc, rule, ruleIndex) => {
    const currentResult = ruleSatisfiedBefore(rule, dependentSlotId, index, considerSameSemester);
    
    if (ruleIndex === 0) {
      return currentResult;
    }
    
    const prevRule = rules[ruleIndex - 1];
    const linkType = prevRule.prerequisiteLinkType || 'und';
    
    return linkType === 'oder' ? acc || currentResult : acc && currentResult;
  }, false);
}

export function hasPrereqAfter(
  dependentSlot: TemplateSlot,
  course: Course,
  index: TemplateIndex,
  options: { considerSameSemester?: boolean } = {}
): boolean {
  const { considerSameSemester = true } = options;
  
  // check if prerequisites cannot be satisfied before the dependent course
  return !evaluatePrerequisitesSchedulableBefore(course.prerequisites, dependentSlot.id, index, considerSameSemester);
}

export type EdgePair = {
  source: TemplateSlot;
  target: TemplateSlot;
};

export function planEdgesForCourse(
  course: Course,
  dependentSlot: TemplateSlot,
  index: TemplateIndex
): EdgePair[] {
  const pairs: EdgePair[] = [];
  const seen = new Set<string>();
  
  course.prerequisites.forEach(rule => {
    rule.modules.forEach(moduleId => {
      const providerSlots = index.providerSlotsBefore(moduleId, dependentSlot.id);
      providerSlots.forEach(sourceSlot => {
        const key = `${sourceSlot.id}->${dependentSlot.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push({ source: sourceSlot, target: dependentSlot });
        }
      });
    });
  });
  
  
  return pairs;
}

export function planEdges(
  template: CurriculumTemplate,
  selections: Record<string, string>,
  index: TemplateIndex
): EdgePair[] {
  const pairs: EdgePair[] = [];
  
  template.slots.forEach(slot => {
    if (slot.type === 'fixed' && slot.courseId) {
      const course = COURSES.find(c => c.id === slot.courseId);
      if (course) {
        const coursePairs = planEdgesForCourse(course, slot, index);
        pairs.push(...coursePairs);
      }
    } else if ((slot.type === 'elective' || slot.type === 'major') && selections[slot.id]) {
      const course = COURSES.find(c => c.id === selections[slot.id]);
      if (course) {
        const coursePairs = planEdgesForCourse(course, slot, index);
        pairs.push(...coursePairs);
      }
    }
  });
  
  return pairs;
}

// memoized dependency depth calculation
const dependencyDepthCache = new Map<string, number>();

export function getCourseDependencyDepth(courseId: string): number {
  if (dependencyDepthCache.has(courseId)) {
    return dependencyDepthCache.get(courseId)!;
  }
  
  const course = COURSES.find(c => c.id === courseId);
  if (!course || course.prerequisites.length === 0) {
    dependencyDepthCache.set(courseId, 0);
    return 0;
  }
  
  let maxDepth = 0;
  course.prerequisites.forEach(rule => {
    rule.modules.forEach(moduleId => {
      maxDepth = Math.max(maxDepth, getCourseDependencyDepth(moduleId) + 1);
    });
  });
  
  dependencyDepthCache.set(courseId, maxDepth);
  return maxDepth;
}

export function getEarliestReferencedSlotPosition(
  course: Course,
  index: TemplateIndex
): number {
  let minPosition = 999;
  
  course.prerequisites.forEach(rule => {
    rule.modules.forEach(moduleId => {
      const providerSlots = index.providerSlotsFor(moduleId);
      providerSlots.forEach(slot => {
        const position = slot.semester * 1000 + slot.semester; // Simplified position calculation
        minPosition = Math.min(minPosition, position);
      });
    });
  });
  
  return minPosition;
}
