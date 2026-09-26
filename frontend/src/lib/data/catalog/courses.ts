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

export function getAvailableModels(studiengang: string): StudyModel[] {
	const models = new Set<StudyModel>();
	getAvailableTemplates().forEach((template) => {
		if (template.studiengang === studiengang) {
			models.add(template.modell);
		}
	});
	return Array.from(models).sort((a, b) => a.localeCompare(b));
}

let _currentPlan: string | null = null;

function currentPlan(): string {
	_currentPlan ??= getDefaultTemplate()?.plan ?? 'HS25';
	return _currentPlan;
}

let _coursesById: Map<string, Course> | null = null;
let _sortedCourses: { locale: string; courses: Course[] } | null = null;

function coursesById(): Map<string, Course> {
	_coursesById ??= new Map(
		loadCourseData(currentPlan()).map((course) => [course.id, course]),
	);
	return _coursesById;
}

export function setCoursePlan(plan: string): void {
	if (_currentPlan === plan) return;
	_currentPlan = plan;
	_coursesById = null;
	_sortedCourses = null;
}

export function getSortedCourses(): Course[] {
	const locale = getLocale();
	if (_sortedCourses?.locale !== locale) {
		_sortedCourses = {
			locale,
			courses: [...coursesById().values()].sort((a, b) =>
				courseLabel(a).localeCompare(courseLabel(b)),
			),
		};
	}
	return _sortedCourses.courses;
}

export function getCourseById(id: string): Course | undefined {
	return coursesById().get(id);
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
