import type { CatalogCourse, ModuleType } from './catalog-types';
import type { Season } from './season';

export type EctsFilter = 'all' | 'small' | 'medium' | 'large';

export type CourseFilters = {
	query: string;
	season: Season | 'all';
	moduleType: ModuleType | 'all';
	ects: EctsFilter;
};

export const EMPTY_FILTERS: CourseFilters = {
	query: '',
	season: 'all',
	moduleType: 'all',
	ects: 'all',
};

// The browser is plan-agnostic, so one type per course: the plan default,
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
	// Match both languages regardless of UI locale: users search for German
	// and English titles interchangeably.
	const haystacks = [course.id, course.label, course.labelEn ?? ''];
	return haystacks.some((text) => text.toLowerCase().includes(normalized));
}

function matchesSeason(course: CatalogCourse, season: Season | 'all'): boolean {
	if (season === 'all') return true;
	// Unknown seasons (empty/missing) mean "offered any time", mirroring
	// isOfferedIn in the elective selector.
	const seasons = course.seasons ?? [];
	return seasons.length === 0 || seasons.includes(season);
}

function matchesEcts(course: CatalogCourse, ects: EctsFilter): boolean {
	switch (ects) {
		case 'all':
			return true;
		case 'small':
			return course.ects < 6;
		case 'medium':
			return course.ects === 6;
		case 'large':
			return course.ects > 6;
	}
}

// All dimensions combine with AND; an empty filter matches everything and
// input order is preserved.
export function filterCourses(
	courses: readonly CatalogCourse[],
	filters: CourseFilters,
): CatalogCourse[] {
	return courses.filter(
		(course) =>
			matchesQuery(course, filters.query) &&
			matchesSeason(course, filters.season) &&
			(filters.moduleType === 'all' ||
				courseModuleType(course) === filters.moduleType) &&
			matchesEcts(course, filters.ects),
	);
}

export function isFiltering(filters: CourseFilters): boolean {
	return (
		filters.query.trim() !== '' ||
		filters.season !== 'all' ||
		filters.moduleType !== 'all' ||
		filters.ects !== 'all'
	);
}
