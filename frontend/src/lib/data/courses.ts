import informatikFulltimeTemplate from './templates/informatik-fulltime.json';
import { loadCourseData } from './course-data-adapter';

export type Status = "locked" | "available" | "completed";

export type ModuleType = "Kernmodul" | "Projektmodul" | "Erweiterungsmodul" | "Major-/Minormodul" | "Zusatzmodul";

export type PrerequisiteLink = "und" | "oder";

export type PrerequisiteRule = {
  modules: string[];
  mustBePassed: boolean;
  moduleLinkType: PrerequisiteLink;
  prerequisiteLinkType?: PrerequisiteLink;
};


export type Course = {
  id: string;
  label: string;
  ects: number;
  prerequisites: PrerequisiteRule[];
  prerequisiteNote?: string;
  assessmentLevelPassed?: boolean;
  type?: ModuleType;
};

let _sortedCourses: Course[] | null = null;
let _coursesById: Record<string, Course> | null = null;
let _currentPlan: string = 'HS25';

function buildCourseCollections(): { sortedCourses: Course[]; coursesMap: Record<string, Course> } {
  if (_sortedCourses && _coursesById) {
    return { sortedCourses: _sortedCourses, coursesMap: _coursesById };
  }

  const courses = loadCourseData(_currentPlan);
  const map: Record<string, Course> = {};
  courses.forEach((course) => {
    map[course.id] = course;
  });

  _coursesById = map;
  _sortedCourses = [...courses].sort((a, b) => a.label.localeCompare(b.label));

  return { sortedCourses: _sortedCourses, coursesMap: _coursesById };
}

export function setCoursePlan(plan: string): void {
  if (_currentPlan !== plan) {
    _currentPlan = plan;
    _sortedCourses = null;
    _coursesById = null;
  }
}

export const COURSES: Course[] = new Proxy([], {
  get(_target, prop) {
    const { sortedCourses } = buildCourseCollections();
    return Reflect.get(sortedCourses, prop);
  },
  has(_target, prop) {
    const { sortedCourses } = buildCourseCollections();
    return Reflect.has(sortedCourses, prop);
  },
  ownKeys(_target) {
    const { sortedCourses } = buildCourseCollections();
    return Reflect.ownKeys(sortedCourses);
  },
  getOwnPropertyDescriptor(_target, prop) {
    const { sortedCourses } = buildCourseCollections();
    return Reflect.getOwnPropertyDescriptor(sortedCourses, prop);
  }
}) as Course[];

export const COURSES_MAP: Record<string, Course> = new Proxy(
  {},
  {
    get(_target, prop) {
      const { coursesMap } = buildCourseCollections();
      return Reflect.get(coursesMap, prop);
    },
    has(_target, prop) {
      const { coursesMap } = buildCourseCollections();
      return Reflect.has(coursesMap, prop);
    },
    ownKeys(_target) {
      const { coursesMap } = buildCourseCollections();
      return Reflect.ownKeys(coursesMap);
    },
    getOwnPropertyDescriptor(_target, prop) {
      const { coursesMap } = buildCourseCollections();
      return Reflect.getOwnPropertyDescriptor(coursesMap, prop);
    }
  }
) as Record<string, Course>;

export function getCourseById(id: string): Course | undefined {
  const { coursesMap } = buildCourseCollections();
  return coursesMap[id];
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

export function calculateSemesterCredits(
  semester: number,
  template: CurriculumTemplate,
  userSelections: Record<string, string>,
  semesterOverrides: Record<string, number> = {}
): number {
  return template.slots
    .filter(slot => (semesterOverrides[slot.id] ?? slot.semester) === semester)
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
