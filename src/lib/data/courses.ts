import coursesData from './courses.json';
import informatikFulltimeTemplate from './templates/informatik-fulltime.json';

export type Status = "locked" | "available" | "completed";

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

export type AdvancedPrerequisite = 
  | PrerequisiteRequirement 
  | CreditRequirement 
  | ProgramSpecificRequirement;

export function isCreditRequirement(prereq: AdvancedPrerequisite): prereq is CreditRequirement {
  return 'type' in prereq && prereq.type === 'credits';
}

export function isProgramSpecificRequirement(prereq: AdvancedPrerequisite): prereq is ProgramSpecificRequirement {
  return 'type' in prereq && prereq.type === 'program_specific';
}

export function isPrerequisiteRequirement(prereq: AdvancedPrerequisite): prereq is PrerequisiteRequirement {
  return 'courses' in prereq && 'requirement' in prereq && !('type' in prereq);
}

export function isAdvancedPrerequisite(prereq: AdvancedPrerequisite): prereq is CreditRequirement | ProgramSpecificRequirement {
  return 'type' in prereq;
}

export type Course = {
  id: string;
  label: string;
  ects: number;
  prereqs: string[] | AdvancedPrerequisite[];
  prereqsPassed?: string[];
  url?: string;
  type?: "Kernmodul" | "Projektmodul" | "Erweiterungsmodul";
};

export const COURSES: Course[] = coursesData as Course[];

export function getCourseById(id: string): Course | undefined {
  return COURSES.find(course => course.id === id);
}


export function getPrerequisitesForCourse(courseId: string): Course[] {
  const course = getCourseById(courseId);
  if (!course) return [];

  return course.prereqs
    .filter((prereq): prereq is string => typeof prereq === 'string')
    .map(prereqId => getCourseById(prereqId))
    .filter(Boolean) as Course[];
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
