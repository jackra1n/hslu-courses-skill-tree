import { evaluatePrerequisites } from '$lib/utils/prerequisite';
import type { CatalogCourse } from '../catalog/catalog-types';
import type { StudyPlan } from '../planning/study-plan';

type SlotStatus = Map<string, 'attended' | 'completed'>;

export function nextCourseIds(
	courses: readonly CatalogCourse[],
	plan: StudyPlan,
	slotStatus: SlotStatus,
	assessmentStageMet: boolean,
): Set<string> {
	const startedCourseIds = new Set<string>();
	for (const node of Object.values(plan.nodes)) {
		if (node.courseId && slotStatus.has(node.id)) {
			startedCourseIds.add(node.courseId);
		}
	}

	const result = new Set<string>();

	for (const course of courses) {
		if (startedCourseIds.has(course.id)) continue;
		if (course.assessmentLevelPassed && !assessmentStageMet) continue;
		if (!evaluatePrerequisites(course.prerequisites, slotStatus, plan))
			continue;
		result.add(course.id);
	}

	return result;
}
