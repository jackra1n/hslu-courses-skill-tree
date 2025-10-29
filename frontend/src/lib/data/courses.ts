import { loadCourseData } from './course-data-adapter';
import studyProgrammes from './hslu_data/study_programmes.json';

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

export type TemplateSlot = {
  id: string;
  type: "fixed" | "elective" | "major";
  courseId?: string; // for fixed courses
  semester: number;
};

export type StudyModel = "fulltime" | "parttime";

export type CurriculumTemplate = {
  id: string;
  name: string;
  studiengang: string;
  modell: StudyModel;
  plan: string; // e.g., "HS16", "HS25"
  slots: TemplateSlot[];
  programShortName?: string;
  programName?: string;
};

type StudyProgramme = {
  ShortName: string;
  Name: string;
};

const STUDY_PROGRAMMES = (studyProgrammes.data ?? []) as StudyProgramme[];

const PROGRAM_NAME_BY_SHORT = new Map<string, string>(
  STUDY_PROGRAMMES.map((program) => [program.ShortName.toUpperCase(), program.Name])
);

const TEMPLATE_PATH_REGEX = /\.\/templates\/([^/]+)\/([^/]+)\/([^/]+)\.json$/i;

const templateModules = import.meta.glob('./templates/**/**/*.json', {
  eager: true,
  import: 'default'
}) as Record<string, CurriculumTemplate>;

function normaliseProgram(segment: string): string {
  return segment.toUpperCase();
}

function normaliseModel(segment: string): StudyModel {
  return segment.toLowerCase() as StudyModel;
}

function normalisePlan(segment: string): string {
  return segment.toUpperCase();
}

function buildAvailableTemplates(): CurriculumTemplate[] {
  const templates: CurriculumTemplate[] = [];

  for (const [path, rawTemplate] of Object.entries(templateModules)) {
    const match = TEMPLATE_PATH_REGEX.exec(path);
    if (!match) {
      console.warn(`Skipping template with unexpected path: ${path}`);
      continue;
    }

    const [, programSegment, modelSegment, planSegment] = match;
    const programShortName = normaliseProgram(programSegment);
    const model = normaliseModel(modelSegment);
    const plan = normalisePlan(planSegment);
    const programName =
      PROGRAM_NAME_BY_SHORT.get(programShortName) ??
      rawTemplate.programName ??
      rawTemplate.studiengang ??
      programShortName;

    const template: CurriculumTemplate = {
      ...rawTemplate,
      id:
        rawTemplate.id ??
        `${programShortName.toLowerCase()}-${model}-${plan.toLowerCase()}`,
      studiengang: programShortName,
      modell: model,
      plan,
      programShortName,
      programName
    };

    templates.push(template);
  }

  if (!templates.length) {
    console.warn('No curriculum templates found in templates directory.');
  }

  return templates.sort((a, b) => {
    if ((a.programName ?? '') !== (b.programName ?? '')) {
      return (a.programName ?? '').localeCompare(b.programName ?? '');
    }
    if (a.modell !== b.modell) {
      return a.modell.localeCompare(b.modell);
    }
    return a.plan.localeCompare(b.plan);
  });
}

export const AVAILABLE_TEMPLATES: CurriculumTemplate[] = buildAvailableTemplates();

const DEFAULT_TEMPLATE = AVAILABLE_TEMPLATES[0];

const TEMPLATE_BY_ID = new Map(AVAILABLE_TEMPLATES.map((template) => [template.id, template]));

export function getTemplateById(id: string): CurriculumTemplate | undefined {
  return TEMPLATE_BY_ID.get(id);
}

export function getTemplatesByProgram(studiengang: string, modell: StudyModel): CurriculumTemplate[] {
  return AVAILABLE_TEMPLATES.filter(
    (template) => template.studiengang === studiengang && template.modell === modell
  );
}

export function getAvailablePlans(studiengang: string, modell: StudyModel): string[] {
  const templates = getTemplatesByProgram(studiengang, modell);
  return [...new Set(templates.map((template) => template.plan))].sort();
}

export function getAvailableModels(studiengang: string): StudyModel[] {
  const models = new Set<StudyModel>();
  AVAILABLE_TEMPLATES.forEach((template) => {
    if (template.studiengang === studiengang) {
      models.add(template.modell);
    }
  });
  return Array.from(models).sort((a, b) => a.localeCompare(b));
}

let _sortedCourses: Course[] | null = null;
let _coursesById: Record<string, Course> | null = null;
let _currentPlan: string = DEFAULT_TEMPLATE?.plan ?? 'HS25';

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
