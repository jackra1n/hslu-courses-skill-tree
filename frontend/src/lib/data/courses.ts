import informatikFulltimeTemplate from './templates/informatik-fulltime.json';
import { loadIdmsCourses } from './idms-adapter';

export type Status = "locked" | "available" | "completed";

export type ModuleType = "Kernmodul" | "Projektmodul" | "Erweiterungsmodul" | "Major-/Minormodul" | "Zusatzmodul";

export type IdmsLink = "und" | "oder";

export type IdmsPrerequisiteRule = {
  modules: string[];
  mustBePassed: boolean;
  moduleLinkType: IdmsLink;
  prerequisiteLinkType?: IdmsLink;
};


export type Course = {
  id: string;
  label: string;
  ects: number;
  prerequisites: IdmsPrerequisiteRule[];
  prerequisiteNote?: string;
  assessmentLevelPassed?: boolean;
  type?: ModuleType;
};

let _sortedCourses: Course[] | null = null;
let _currentPlan: string = 'HS25';

function getSortedCourses(): Course[] {
  if (_sortedCourses === null) {
    _sortedCourses = loadIdmsCourses(_currentPlan).sort((a, b) => {
      return a.label.localeCompare(b.label);
    });
  }
  return _sortedCourses;
}

export function setCoursePlan(plan: string): void {
  if (_currentPlan !== plan) {
    _currentPlan = plan;
    _sortedCourses = null;
  }
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
  
  course.prerequisites.forEach(rule => {
    rule.modules.forEach(moduleId => {
      const prereqCourse = getCourseById(moduleId);
      if (prereqCourse) {
        prerequisiteCourses.push(prereqCourse);
      }
    });
  });
  
  return prerequisiteCourses;
}

export function calculateCreditsCompleted(
  completed: Set<string>, 
  moduleType?: ModuleType
): number {
  return COURSES
    .filter(course => completed.has(course.id) && (!moduleType || course.type === moduleType))
    .reduce((total, course) => total + course.ects, 0);
}

export function calculateCreditsAttended(
  attended: Set<string>, 
  completed: Set<string>,
  moduleType?: ModuleType
): number {
  return COURSES
    .filter(course => (attended.has(course.id) || completed.has(course.id)) && (!moduleType || course.type === moduleType))
    .reduce((total, course) => total + course.ects, 0);
}

export type TemplateSlot = {
  id: string;
  type: "fixed" | "elective" | "major";
  courseId?: string; // for fixed courses
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
