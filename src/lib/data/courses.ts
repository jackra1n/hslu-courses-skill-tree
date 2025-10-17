import coursesData from './courses.json';
import informatikFulltimeTemplate from './templates/informatik-fulltime.json';

export type Status = "locked" | "available" | "completed";

// base requirement types
export type PrerequisiteRequirement = {
  courses: string[];
  requirement: "besucht" | "bestanden";
};

export type CreditRequirement = {
  type: "credits";
  moduleType?: "Kernmodul" | "Projektmodul" | "Erweiterungsmodul";
  minCredits: number;
};

export type ProgramSpecificRequirement = {
  type: "program_specific";
  program: string;
  requirements: PrerequisiteRequirement[];
};

export type AssessmentStageRequirement = {
  type: "assessment_stage";
  requirement: "bestanden";
};

// expression tree for complex logic
export type PrerequisiteExpression = 
  | PrerequisiteRequirement 
  | CreditRequirement 
  | ProgramSpecificRequirement
  | AssessmentStageRequirement
  | AndExpression
  | OrExpression;

export type AndExpression = {
  type: "and";
  operands: PrerequisiteExpression[];
};

export type OrExpression = {
  type: "or";
  operands: PrerequisiteExpression[];
};

// type guards
export function isCreditRequirement(prereq: PrerequisiteExpression): prereq is CreditRequirement {
  return typeof prereq === 'object' && prereq !== null && 'type' in prereq && prereq.type === 'credits';
}

export function isProgramSpecificRequirement(prereq: PrerequisiteExpression): prereq is ProgramSpecificRequirement {
  return typeof prereq === 'object' && prereq !== null && 'type' in prereq && prereq.type === 'program_specific';
}

export function isAssessmentStageRequirement(prereq: PrerequisiteExpression): prereq is AssessmentStageRequirement {
  return typeof prereq === 'object' && prereq !== null && 'type' in prereq && prereq.type === 'assessment_stage';
}

export function isPrerequisiteRequirement(prereq: PrerequisiteExpression): prereq is PrerequisiteRequirement {
  return typeof prereq === 'object' && prereq !== null && 'courses' in prereq && 'requirement' in prereq && !('type' in prereq);
}

export function isAndExpression(expr: PrerequisiteExpression): expr is AndExpression {
  return typeof expr === 'object' && expr !== null && 'type' in expr && expr.type === 'and';
}

export function isOrExpression(expr: PrerequisiteExpression): expr is OrExpression {
  return typeof expr === 'object' && expr !== null && 'type' in expr && expr.type === 'or';
}

export function isExpressionTree(expr: PrerequisiteExpression): expr is AndExpression | OrExpression {
  return isAndExpression(expr) || isOrExpression(expr);
}

export type Course = {
  id: string;
  label: string;
  ects: number;
  prereqs: PrerequisiteExpression[];
  prereqsPassed?: string[];
  url?: string;
  type?: "Kernmodul" | "Projektmodul" | "Erweiterungsmodul";
};

let _sortedCourses: Course[] | null = null;

function getSortedCourses(): Course[] {
  if (_sortedCourses === null) {
    _sortedCourses = [...coursesData].sort((a, b) => {
      return a.label.localeCompare(b.label);
    }) as Course[];
  }
  return _sortedCourses;
}

export const COURSES: Course[] = new Proxy([], {
  get(_target, prop) {
    const sortedCourses = getSortedCourses();
    return Reflect.get(sortedCourses, prop);
  },
  has(_target, prop) {
    const sortedCourses = getSortedCourses();
    return Reflect.has(sortedCourses, prop);
  },
  ownKeys(_target) {
    const sortedCourses = getSortedCourses();
    return Reflect.ownKeys(sortedCourses);
  },
  getOwnPropertyDescriptor(_target, prop) {
    const sortedCourses = getSortedCourses();
    return Reflect.getOwnPropertyDescriptor(sortedCourses, prop);
  }
}) as Course[];

export function getCourseById(id: string): Course | undefined {
  return COURSES.find(course => course.id === id);
}


export function getPrerequisitesForCourse(courseId: string): Course[] {
  const course = getCourseById(courseId);
  if (!course) return [];

  const prerequisiteCourses: Course[] = [];
  
  course.prereqs.forEach(prereq => {
    if (isPrerequisiteRequirement(prereq)) {
      prereq.courses.forEach(courseId => {
        const prereqCourse = getCourseById(courseId);
        if (prereqCourse) {
          prerequisiteCourses.push(prereqCourse);
        }
      });
    }
  });
  
  return prerequisiteCourses;
}

export function calculateCreditsCompleted(
  completed: Set<string>, 
  moduleType?: "Kernmodul" | "Projektmodul" | "Erweiterungsmodul"
): number {
  return COURSES
    .filter(course => completed.has(course.id) && (!moduleType || course.type === moduleType))
    .reduce((total, course) => total + course.ects, 0);
}

export function calculateCreditsAttended(
  attended: Set<string>, 
  completed: Set<string>,
  moduleType?: "Kernmodul" | "Projektmodul" | "Erweiterungsmodul"
): number {
  return COURSES
    .filter(course => (attended.has(course.id) || completed.has(course.id)) && (!moduleType || course.type === moduleType))
    .reduce((total, course) => total + course.ects, 0);
}

export type TemplateSlot = {
  id: string;
  type: "fixed" | "elective" | "major";
  courseId?: string; // for fixed courses
  credits: number;
  label: string;
  semester: number;
};

export type CurriculumTemplate = {
  id: string;
  name: string;
  studiengang: string;
  modell: "fulltime" | "parttime";
  plan: string; // e.g., "HS16", "HS25"
  slots: TemplateSlot[];
};

export const AVAILABLE_TEMPLATES: CurriculumTemplate[] = [
  informatikFulltimeTemplate as CurriculumTemplate
];

export function getTemplateById(id: string): CurriculumTemplate | undefined {
  return AVAILABLE_TEMPLATES.find(template => template.id === id);
}

export function getTemplatesByProgram(studiengang: string, modell: "fulltime" | "parttime"): CurriculumTemplate[] {
  return AVAILABLE_TEMPLATES.filter(template => 
    template.studiengang === studiengang && template.modell === modell
  );
}

export function getAvailablePlans(studiengang: string, modell: "fulltime" | "parttime"): string[] {
  const templates = getTemplatesByProgram(studiengang, modell);
  return [...new Set(templates.map(template => template.plan))].sort();
}

export function getCoursesForSlot(slot: TemplateSlot, userSelections: Record<string, string>): Course[] {
  if (slot.type === "fixed" && slot.courseId) {
    const course = getCourseById(slot.courseId);
    return course ? [course] : [];
  }
  
  if (slot.type === "elective" || slot.type === "major") {
    const selectedCourseId = userSelections[slot.id];
    if (selectedCourseId) {
      const course = getCourseById(selectedCourseId);
      return course ? [course] : [];
    }
    return [];
  }
  
  return [];
}

export function calculateSemesterCredits(semester: number, template: CurriculumTemplate, userSelections: Record<string, string>): number {
  return template.slots
    .filter(slot => slot.semester === semester)
    .reduce((total, slot) => {
      const courses = getCoursesForSlot(slot, userSelections);
      return total + courses.reduce((sum, course) => sum + course.ects, 0);
    }, 0);
}

export function calculateTotalCredits(template: CurriculumTemplate, userSelections: Record<string, string>): number {
  return template.slots.reduce((total, slot) => {
    const courses = getCoursesForSlot(slot, userSelections);
    return total + courses.reduce((sum, course) => sum + course.ects, 0);
  }, 0);
}

// evaluation functions for prerequisite expressions
export type UserProgress = {
  completed: Set<string>;
  attended: Set<string>;
};

export function evaluatePrerequisiteExpression(
  expr: PrerequisiteExpression,
  userProgress: UserProgress
): boolean {

  if ('courses' in expr && 'requirement' in expr && !('type' in expr)) {
    const { courses, requirement } = expr;
    if (requirement === 'bestanden') {
      return courses.every(courseId => userProgress.completed.has(courseId));
    } else {
      return courses.every(courseId => 
        userProgress.attended.has(courseId) || userProgress.completed.has(courseId)
      );
    }
  }

  if (isCreditRequirement(expr)) {
    const credits = calculateCreditsCompleted(
      userProgress.completed,
      expr.moduleType
    );
    return credits >= expr.minCredits;
  }

  if ('type' in expr && expr.type === 'program_specific') {
    // for now, we'll need to know the current program to evaluate this
    // this could be extended to accept program context
    return false;
  }

  if ('type' in expr && expr.type === 'assessment_stage') {
    return userProgress.completed.size >= 6; // approximate threshold
  }

  if (isAndExpression(expr)) {
    return expr.operands.every(operand => 
      evaluatePrerequisiteExpression(operand, userProgress)
    );
  }

  if (isOrExpression(expr)) {
    return expr.operands.some(operand => 
      evaluatePrerequisiteExpression(operand, userProgress)
    );
  }
  return false;
}

export function evaluateCoursePrerequisites(
  course: Course,
  userProgress: UserProgress
): boolean {
  if (!course.prereqs || course.prereqs.length === 0) {
    return true;
  }

  return course.prereqs.every(expr => 
    evaluatePrerequisiteExpression(expr, userProgress)
  );
}

export function createAndExpression(...operands: PrerequisiteExpression[]): AndExpression {
  return { type: 'and', operands };
}

export function createOrExpression(...operands: PrerequisiteExpression[]): OrExpression {
  return { type: 'or', operands };
}

export function createPrerequisiteRequirement(
  courses: string[], 
  requirement: "besucht" | "bestanden"
): PrerequisiteRequirement {
  return { courses, requirement };
}

export function createAssessmentStageRequirement(): AssessmentStageRequirement {
  return { type: 'assessment_stage', requirement: 'bestanden' };
}

export type ExtendedNodeData = {
  label: string;
  slot?: TemplateSlot;
  course?: Course;
  isElectiveSlot?: boolean;
  width?: number;
  sourceHandles?: number;
  targetHandles?: number;
  showCourseTypeBadges?: boolean;
  hasLaterPrerequisites?: boolean;
};
