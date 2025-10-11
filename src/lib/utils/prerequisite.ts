import type { 
  PrerequisiteExpression, 
  UserProgress, 
  Course
} from '../data/courses';
import { 
  evaluatePrerequisiteExpression,
  evaluateCoursePrerequisites
} from '../data/courses';

export function evaluatePrerequisite(
  prereq: string | PrerequisiteExpression,
  attended: Set<string>,
  completed: Set<string>
): boolean {
  const userProgress: UserProgress = { attended, completed };
  
  if (typeof prereq === 'string') {
    if (prereq === "assessmentstufe bestanden") {
      return completed.size >= 6; // approximate threshold
    }
    return attended.has(prereq) || completed.has(prereq);
  }

  return evaluatePrerequisiteExpression(prereq, userProgress);
}

export function getPrerequisiteDisplayText(prereq: PrerequisiteExpression, courses: Course[]): string {
  if (typeof prereq === 'string') {
    if (prereq === "assessmentstufe bestanden") {
      return "Assessment Stage Passed";
    }
    const course = courses.find(c => c.id === prereq);
    return course?.label || prereq;
  }

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
