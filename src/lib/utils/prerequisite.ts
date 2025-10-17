import type { 
  PrerequisiteExpression, 
  UserProgress,
  Course,
  PrerequisiteRequirement,
  CreditRequirement,
  ProgramSpecificRequirement,
  AssessmentStageRequirement,
  AndExpression,
  OrExpression
} from '../data/courses';
import { 
  evaluatePrerequisiteExpression,
  evaluateCoursePrerequisites,
  COURSES,
  isPrerequisiteRequirement,
  isAndExpression,
  isOrExpression,
  isCreditRequirement,
  isAssessmentStageRequirement,
  isProgramSpecificRequirement
} from '../data/courses';

export function evaluatePrerequisite(
  prereq: PrerequisiteExpression,
  attended: Set<string>,
  completed: Set<string>
): boolean {
  const userProgress: UserProgress = { attended, completed };
  return evaluatePrerequisiteExpression(prereq, userProgress);
}

export function getPrerequisiteDisplayText(prereq: PrerequisiteExpression, courses: Course[]): string {

  if ('courses' in prereq && 'requirement' in prereq && !('type' in prereq)) {
    const courseLabels = prereq.courses.map(courseId => {
      const course = courses.find(c => c.id === courseId);
      return course?.label || courseId;
    });
    return `${prereq.requirement === "besucht" ? "Attended" : "Completed"}: ${courseLabels.join(", ")}`;
  }

  if ('type' in prereq && prereq.type === 'credits') {
    const creditsReq = prereq as { moduleType?: string };
    return creditsReq.moduleType ? `${creditsReq.moduleType} Credits` : 'Total Credits';
  }

  if ('type' in prereq && prereq.type === 'program_specific') {
    const progReq = prereq as { program: string };
    return progReq.program;
  }

  if ('type' in prereq && prereq.type === 'assessment_stage') {
    return "Assessment Stage Passed";
  }

  if ('type' in prereq && prereq.type === 'and') {
    return "All of:";
  }

  if ('type' in prereq && prereq.type === 'or') {
    return "One of:";
  }

  return "Complex requirement";
}

export function getPrerequisiteStatus(
  prereq: PrerequisiteExpression,
  attended: Set<string>,
  completed: Set<string>
): boolean {
  return evaluatePrerequisite(prereq, attended, completed);
}

export function getCoursePrerequisitesStatus(
  course: Course,
  attended: Set<string>,
  completed: Set<string>
): boolean {
  const userProgress: UserProgress = { attended, completed };
  return evaluateCoursePrerequisites(course, userProgress);
}

// AST traversal helpers for prerequisite expressions
export function visitExpr(
  expr: PrerequisiteExpression,
  visitor: {
    onRequirement?: (req: PrerequisiteRequirement) => void;
    onAnd?: (expr: AndExpression) => void;
    onOr?: (expr: OrExpression) => void;
    onProgramSpecific?: (req: ProgramSpecificRequirement) => void;
    onCredit?: (req: CreditRequirement) => void;
    onAssessmentStage?: (req: AssessmentStageRequirement) => void;
  }
): void {
  if (isPrerequisiteRequirement(expr)) {
    visitor.onRequirement?.(expr);
  } else if (isAndExpression(expr)) {
    visitor.onAnd?.(expr);
    expr.operands.forEach(operand => visitExpr(operand, visitor));
  } else if (isOrExpression(expr)) {
    visitor.onOr?.(expr);
    expr.operands.forEach(operand => visitExpr(operand, visitor));
  } else if (isProgramSpecificRequirement(expr)) {
    visitor.onProgramSpecific?.(expr);
    expr.requirements.forEach(req => visitExpr(req, visitor));
  } else if (isCreditRequirement(expr)) {
    visitor.onCredit?.(expr);
  } else if (isAssessmentStageRequirement(expr)) {
    visitor.onAssessmentStage?.(expr);
  }
}

export function anyCourse(
  expr: PrerequisiteExpression,
  predicate: (courseId: string) => boolean
): boolean {
  let found = false;
  visitExpr(expr, {
    onRequirement: (req) => {
      if (!found && req.courses.some(predicate)) {
        found = true;
      }
    }
  });
  return found;
}

export function countCourses(
  expr: PrerequisiteExpression,
  predicate: (courseId: string) => boolean
): number {
  let count = 0;
  visitExpr(expr, {
    onRequirement: (req) => {
      count += req.courses.filter(predicate).length;
    }
  });
  return count;
}

export function courseIds(expr: PrerequisiteExpression): Set<string> {
  const ids = new Set<string>();
  visitExpr(expr, {
    onRequirement: (req) => {
      req.courses.forEach(id => ids.add(id));
    }
  });
  return ids;
}

export function exprReferencesCourse(expr: PrerequisiteExpression, courseId: string): boolean {
  return anyCourse(expr, id => id === courseId);
}

import type { TemplateSlot } from '../types';
import { TemplateIndex } from './template-index';

export function hasPrereqAfter(
  dependentSlot: TemplateSlot,
  expr: PrerequisiteExpression,
  index: TemplateIndex,
  options: { considerSameSemester?: boolean } = {}
): boolean {
  const { considerSameSemester = true } = options;
  
  return anyCourse(expr, courseId => {
    const providerSlots = considerSameSemester 
      ? index.providerSlotsAfterOrSame(courseId, dependentSlot.id)
      : index.providerSlotsFor(courseId).filter(slot => slot.semester > dependentSlot.semester);
    
    return providerSlots.length > 0;
  });
}

import type { CurriculumTemplate } from '../types';

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
  
  course.prereqs.forEach(prereq => {
    const prereqPairs = planEdgesForExpression(prereq, dependentSlot, index);
    pairs.push(...prereqPairs);
  });
  
  return pairs;
}

function planEdgesForExpression(
  expr: PrerequisiteExpression,
  dependentSlot: TemplateSlot,
  index: TemplateIndex
): EdgePair[] {
  const pairs: EdgePair[] = [];
  
  if (isPrerequisiteRequirement(expr)) {
    expr.courses.forEach(courseId => {
      const providerSlots = index.providerSlotsBefore(courseId, dependentSlot.id);
      providerSlots.forEach(sourceSlot => {
        pairs.push({ source: sourceSlot, target: dependentSlot });
      });
    });
  } else if (isProgramSpecificRequirement(expr)) {
    for (const req of expr.requirements) {
      if (isPrerequisiteRequirement(req)) {
        const availableCourseId = req.courses.find(courseId => 
          index.hasCourseInTemplate(courseId)
        );
        if (availableCourseId) {
          const providerSlots = index.providerSlotsBefore(availableCourseId, dependentSlot.id);
          providerSlots.forEach(sourceSlot => {
            pairs.push({ source: sourceSlot, target: dependentSlot });
          });
          break;
        }
      }
    }
  } else if (isAndExpression(expr) || isOrExpression(expr)) {
    expr.operands.forEach(operand => {
      const operandPairs = planEdgesForExpression(operand, dependentSlot, index);
      pairs.push(...operandPairs);
    });
  }
  
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
  if (!course || course.prereqs.length === 0) {
    dependencyDepthCache.set(courseId, 0);
    return 0;
  }
  
  let maxDepth = 0;
  course.prereqs.forEach(prereq => {
    if (isPrerequisiteRequirement(prereq)) {
      prereq.courses.forEach(prereqCourseId => {
        maxDepth = Math.max(maxDepth, getCourseDependencyDepth(prereqCourseId) + 1);
      });
    } else if (isAndExpression(prereq) || isOrExpression(prereq)) {
      prereq.operands.forEach(operand => {
        if (isPrerequisiteRequirement(operand)) {
          operand.courses.forEach(prereqCourseId => {
            maxDepth = Math.max(maxDepth, getCourseDependencyDepth(prereqCourseId) + 1);
          });
        }
      });
    }
  });
  
  dependencyDepthCache.set(courseId, maxDepth);
  return maxDepth;
}

export function getEarliestReferencedSlotPosition(
  expr: PrerequisiteExpression,
  index: TemplateIndex
): number {
  let minPosition = 999;
  
  visitExpr(expr, {
    onRequirement: (req) => {
      req.courses.forEach(courseId => {
        const providerSlots = index.providerSlotsFor(courseId);
        providerSlots.forEach(slot => {
          const position = slot.semester * 1000 + slot.semester; // Simplified position calculation
          minPosition = Math.min(minPosition, position);
        });
      });
    }
  });
  
  return minPosition;
}
