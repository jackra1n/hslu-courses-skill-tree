import { loadBundledCatalog } from './catalog-loader';
import type { CatalogCourse, Course } from './catalog-types';

const courseCache = new Map<string, Course[]>();

function courseTypeForPlan(
	course: CatalogCourse,
	plan: string,
): Course['type'] {
	if (plan.startsWith('HS')) return course.typeByPlanSeason.HS;
	if (plan.startsWith('FS')) return course.typeByPlanSeason.FS;
	return course.typeByPlanSeason.default;
}

export function loadCourseData(plan: string = 'HS25'): Course[] {
	const cached = courseCache.get(plan);
	if (cached) return cached;

	const courses = loadBundledCatalog().courses.map((catalogCourse) => {
		const { typeByPlanSeason: _, ...course } = catalogCourse;
		return { ...course, type: courseTypeForPlan(catalogCourse, plan) };
	});
	courseCache.set(plan, courses);
	return courses;
}
