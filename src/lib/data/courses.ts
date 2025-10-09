import coursesData from './courses.json';

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

// Type guards
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
  semester: number;
  type?: "Kernmodul" | "Projektmodul" | "Erweiterungsmodul";
};

export const COURSES: Course[] = coursesData as Course[];

export function getCourseById(id: string): Course | undefined {
  return COURSES.find(course => course.id === id);
}

export function getCoursesBySemester(semester: number): Course[] {
  return COURSES.filter(course => course.semester === semester);
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
