import coursesData from './courses.json';

export type Status = "locked" | "available" | "completed";

export type PrerequisiteRequirement = {
  courses: string[];
  requirement: "besucht" | "bestanden";
};

export type Course = {
  id: string;
  label: string;
  ects: number;
  prereqs: string[] | PrerequisiteRequirement[];
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

  return course.prereqs.map(prereqId => getCourseById(prereqId)).filter(Boolean) as Course[];
}
