import { getLocale } from '$lib/paraglide/runtime';
import { getCatalog } from './catalog-loader';
import type {
	Course,
	CurriculumTemplate,
	StudyModel,
	TemplateSlot,
} from './catalog-types';
import { loadCourseData } from './course-data-adapter';
import { courseLabel } from '../courses/course-label';

export type {
	Course,
	CurriculumTemplate,
	ModuleType,
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

export function getDefaultTemplate(): CurriculumTemplate | undefined {
	return getAvailableTemplates().find(
		(template) =>
			template.studiengang === 'INF' && template.modell === 'fulltime',
	);
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

export function getCourseById(id: string): Course | undefined {
	const { coursesMap } = buildCourseCollections();
	return coursesMap[id];
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
	hasLaterPrerequisites?: boolean;
};
