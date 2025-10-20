import type { 
  Course,
  IdmsPrerequisiteRule
} from '$lib/data/courses';
import { 
  COURSES
} from '$lib/data/courses';
import type { TemplateSlot, CurriculumTemplate } from '$lib/data/courses';
import { TemplateIndex } from '$lib/utils/template-index';

export function evaluatePrerequisiteRule(
  rule: IdmsPrerequisiteRule,
  attended: Set<string>,
  completed: Set<string>
): boolean {
  const modules = rule.modules;
  const requiredSet = rule.mustBePassed ? completed : 
    new Set([...attended, ...completed]);
  
  if (rule.moduleLinkType === 'oder') {
    return modules.some(moduleId => requiredSet.has(moduleId));
  } else {
    return modules.every(moduleId => requiredSet.has(moduleId));
  }
}

export function evaluatePrerequisites(
  rules: IdmsPrerequisiteRule[],
  attended: Set<string>,
  completed: Set<string>
): boolean {
  if (rules.length === 0) return true;
  
  let result = evaluatePrerequisiteRule(rules[0], attended, completed);
  
  for (let i = 1; i < rules.length; i++) {
    const prevRule = rules[i - 1];
    const currentRule = rules[i];
    const currentResult = evaluatePrerequisiteRule(currentRule, attended, completed);
    
    const linkType = prevRule.prerequisiteLinkType || 'und';
    
    if (linkType === 'oder') {
      result = result || currentResult;
    } else {
      result = result && currentResult;
    }
  }
  
  return result;
}

export function hasPrereqAfter(
  dependentSlot: TemplateSlot,
  course: Course,
  index: TemplateIndex,
  options: { considerSameSemester?: boolean } = {}
): boolean {
  const { considerSameSemester = true } = options;
  
  return course.prerequisites.some(rule => 
    rule.modules.some(moduleId => {
      const providerSlots = considerSameSemester 
        ? index.providerSlotsAfterOrSame(moduleId, dependentSlot.id)
        : index.providerSlotsFor(moduleId).filter(slot => slot.semester > dependentSlot.semester);
      
      return providerSlots.length > 0;
    })
  );
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
  
  course.prerequisites.forEach(rule => {
    rule.modules.forEach(moduleId => {
      const providerSlots = index.providerSlotsBefore(moduleId, dependentSlot.id);
      providerSlots.forEach(sourceSlot => {
        pairs.push({ source: sourceSlot, target: dependentSlot });
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
