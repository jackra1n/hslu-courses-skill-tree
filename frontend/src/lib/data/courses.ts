import { getLocale } from '$lib/paraglide/runtime';
import { getCatalog } from './catalog-loader';
import type {
	Course,
	CurriculumTemplate,
	ModuleType,
	StudyModel,
	TemplateSlot,
} from './catalog-types';
import { loadCourseData } from './course-data-adapter';
import { courseLabel } from './course-label';

export type {
	Course,
	CurriculumTemplate,
	ModuleType,
	PrerequisiteLink,
	PrerequisiteRule,
	StudyModel,
	TemplateSlot,
} from './catalog-types';

export type Status = 'locked' | 'available' | 'completed';

let _templateIndex: {
	templates: readonly CurriculumTemplate[];
	byId: Map<string, CurriculumTemplate>;
} | null = null;

function getTemplateIndex(): NonNullable<typeof _templateIndex> {
	if (!_templateIndex) {
		const templates = getCatalog().templates;
		_templateIndex = {
			templates,
			byId: new Map(templates.map((template) => [template.id, template])),
		};
	}
	return _templateIndex;
}

export function getAvailableTemplates(): readonly CurriculumTemplate[] {
	return getTemplateIndex().templates;
}

function getDefaultTemplate(): CurriculumTemplate | undefined {
	return getAvailableTemplates()[0];
}

export function getTemplateById(id: string): CurriculumTemplate | undefined {
	return getTemplateIndex().byId.get(id);
}

export function getTemplatesByProgram(
	studiengang: string,
	modell: StudyModel,
): CurriculumTemplate[] {
	return getAvailableTemplates().filter(
		(template) =>
			template.studiengang === studiengang && template.modell === modell,
	);
}

export function getAvailablePlans(
	studiengang: string,
	modell: StudyModel,
): string[] {
	const templates = getTemplatesByProgram(studiengang, modell);
	return [...new Set(templates.map((template) => template.plan))].sort();
}

let _currentPlan: string | null = null;

function currentPlan(): string {
	_currentPlan ??= getDefaultTemplate()?.plan ?? 'HS25';
	return _currentPlan;
}

export function getAvailableModels(studiengang: string): StudyModel[] {
	const models = new Set<StudyModel>();
	getAvailableTemplates().forEach((template) => {
		if (template.studiengang === studiengang) {
			models.add(template.modell);
		}
	});
	return Array.from(models).sort((a, b) => a.localeCompare(b));
}

let _sortedCourses: Course[] | null = null;
let _sortedCoursesLocale: string | null = null;
let _coursesById: Record<string, Course> | null = null;

function buildCourseCollections(): {
	sortedCourses: Course[];
	coursesMap: Record<string, Course>;
} {
	const activeLocale = getLocale();
	if (_sortedCourses && _sortedCoursesLocale === activeLocale && _coursesById) {
		return { sortedCourses: _sortedCourses, coursesMap: _coursesById };
	}

	const courses = _coursesById
		? Object.values(_coursesById)
		: loadCourseData(currentPlan());
	if (!_coursesById) {
		_coursesById = Object.fromEntries(
			courses.map((course) => [course.id, course]),
		);
	}
	_sortedCourses = [...courses].sort((a, b) =>
		courseLabel(a).localeCompare(courseLabel(b)),
	);
	_sortedCoursesLocale = activeLocale;

	return { sortedCourses: _sortedCourses, coursesMap: _coursesById };
}

export function setCoursePlan(plan: string): void {
	if (_currentPlan !== plan) {
		_currentPlan = plan;
		_sortedCourses = null;
		_sortedCoursesLocale = null;
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
	},
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
		},
	},
) as Record<string, Course>;

export function getCourseById(id: string): Course | undefined {
	const { coursesMap } = buildCourseCollections();
	return coursesMap[id];
}

export function getPrerequisitesForCourse(courseId: string): Course[] {
	const course = getCourseById(courseId);
	if (!course) return [];

	const prerequisiteCourses: Course[] = [];

	course.prerequisites.forEach((rule) => {
		rule.modules.forEach((moduleId) => {
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
	moduleType?: ModuleType,
): number {
	return COURSES.filter(
		(course) =>
			completed.has(course.id) && (!moduleType || course.type === moduleType),
	).reduce((total, course) => total + course.ects, 0);
}

export function calculateCreditsAttended(
	attended: Set<string>,
	completed: Set<string>,
	moduleType?: ModuleType,
): number {
	return COURSES.filter(
		(course) =>
			(attended.has(course.id) || completed.has(course.id)) &&
			(!moduleType || course.type === moduleType),
	).reduce((total, course) => total + course.ects, 0);
}

export function getCoursesForSlot(
	slot: TemplateSlot,
	userSelections: Record<string, string>,
): Course[] {
	if (slot.type === 'fixed' && slot.courseId) {
		const course = getCourseById(slot.courseId);
		return course ? [course] : [];
	}

	if (slot.type === 'elective' || slot.type === 'major') {
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
	semesterOverrides: Record<string, number> = {},
): number {
	return template.slots
		.filter(
			(slot) => (semesterOverrides[slot.id] ?? slot.semester) === semester,
		)
		.reduce((total, slot) => {
			const courses = getCoursesForSlot(slot, userSelections);
			return total + courses.reduce((sum, course) => sum + course.ects, 0);
		}, 0);
}

export function calculateTotalCredits(
	template: CurriculumTemplate,
	userSelections: Record<string, string>,
): number {
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
	showRemoveButton?: boolean;
	onRemove?: (nodeId: string) => void;
	hasMissingPrerequisites?: boolean;
	hasLaterPrerequisites?: boolean;
};
