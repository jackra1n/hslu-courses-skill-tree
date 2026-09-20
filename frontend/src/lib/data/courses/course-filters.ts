import type {
	AssessmentMode,
	CatalogCourse,
	ModuleType,
} from '../catalog/catalog-types';
import type { Season } from '../season';

// inclusive ECTS bounds. Null means unbounded (matches everything).
export type EctsRange = { min: number; max: number } | null;

export type CourseFilters = {
	query: string;
	season: Season | 'all';
	moduleTypes: ModuleType[];
	assessmentModes: AssessmentMode[];
	ects: EctsRange;
};

export const EMPTY_FILTERS: CourseFilters = {
	query: '',
	season: 'all',
	moduleTypes: [],
	assessmentModes: [],
	ects: null,
};

// the browser is plan-agnostic, so one type per course: the plan default,
// falling back to a season-specific type when no default was computed.
export function courseModuleType(
	course: CatalogCourse,
): ModuleType | undefined {
	return (
		course.typeByPlanSeason.default ??
		course.typeByPlanSeason.HS ??
		course.typeByPlanSeason.FS
	);
}

function matchesQuery(course: CatalogCourse, query: string): boolean {
	const normalized = query.trim().toLowerCase();
	if (normalized === '') return true;
	// match both languages regardless of UI locale: users search for German
	// and English titles interchangeably.
	const haystacks = [course.id, course.label, course.labelEn ?? ''];
	return haystacks.some((text) => text.toLowerCase().includes(normalized));
}

function matchesSeason(course: CatalogCourse, season: Season | 'all'): boolean {
	if (season === 'all') return true;
	// unknown seasons (empty/missing) mean "offered any time", mirroring
	// isOfferedIn in the elective selector.
	const seasons = course.seasons ?? [];
	return seasons.length === 0 || seasons.includes(season);
}

function matchesEcts(course: CatalogCourse, ects: EctsRange): boolean {
	if (ects === null) return true;
	return course.ects >= ects.min && course.ects <= ects.max;
}

// all dimensions combine with AND; an empty filter matches everything and
// input order is preserved.
export function filterCourses(
	courses: readonly CatalogCourse[],
	filters: CourseFilters,
): CatalogCourse[] {
	return courses.filter(
		(course) =>
			matchesQuery(course, filters.query) &&
			matchesSeason(course, filters.season) &&
			(filters.moduleTypes.length === 0 ||
				filters.moduleTypes.some(
					(type) => courseModuleType(course) === type,
				)) &&
			(filters.assessmentModes.length === 0 ||
				course.assessmentModes.some((mode) =>
					filters.assessmentModes.includes(mode),
				)) &&
			matchesEcts(course, filters.ects),
	);
}

export function isFiltering(filters: CourseFilters): boolean {
	return (
		filters.query.trim() !== '' ||
		filters.season !== 'all' ||
		filters.moduleTypes.length > 0 ||
		filters.assessmentModes.length > 0 ||
		filters.ects !== null
	);
}
