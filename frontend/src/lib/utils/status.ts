import { getTemplateById } from '$lib/data/courses';
import type { StudyPlan } from '$lib/data/study-plan';
import { calculateCompletedCredits, resolveCourse } from '$lib/data/study-plan';
import type { Status } from '../types';
import { assessmentStagePassed } from './assessment-stage';
import { evaluatePrerequisites } from './prerequisite';

export function getAssessmentStageProgress(
	plan: StudyPlan,
	slotStatus: Map<string, 'attended' | 'completed'>,
): { completedEcts: number; projectEcts: number; passed: boolean } {
	const completedEcts = calculateCompletedCredits(plan, slotStatus);
	const projectEcts = Object.values(plan.nodes).reduce((sum, node) => {
		if (slotStatus.get(node.id) !== 'completed') return sum;
		return resolveCourse(node.courseId)?.type === 'Projektmodul'
			? sum + (node.ects || 0)
			: sum;
	}, 0);
	return {
		completedEcts,
		projectEcts,
		passed: assessmentStagePassed(completedEcts, projectEcts),
	};
}

export function computeStatuses(
	plan: StudyPlan,
	slotStatus: Map<string, 'attended' | 'completed'>,
): Record<string, Status> {
	const statuses: Record<string, Status> = {};
	const assessmentStageMet = getAssessmentStageProgress(
		plan,
		slotStatus,
	).passed;

	Object.values(plan.nodes).forEach((node) => {
		const currentStatus = slotStatus.get(node.id);
		if (currentStatus === 'completed') {
			statuses[node.id] = 'completed';
			return;
		}

		if (!node.courseId) {
			statuses[node.id] = node.kind === 'elective' ? 'available' : 'locked';
			return;
		}

		const course = resolveCourse(node.courseId);
		if (!course) {
			statuses[node.id] = 'locked';
			return;
		}

		const prereqsMet = evaluatePrerequisites(
			course.prerequisites,
			slotStatus,
			plan,
		);
		const assessmentMet = !course.assessmentLevelPassed || assessmentStageMet;
		statuses[node.id] = prereqsMet && assessmentMet ? 'available' : 'locked';
	});

	return statuses;
}

type NodeWarnings = {
	hasMissingPrerequisites: boolean;
	hasAssessmentStageViolation: boolean;
};

/** Plan-only warnings, computed once rather than on every canvas restyle. */
export function computePlanWarnings(plan: StudyPlan): Record<string, NodeWarnings> {
	const nodes = Object.values(plan.nodes);
	const coursesInPlan = new Set<string>();
	for (const node of nodes) {
		if (node.courseId) coursesInPlan.add(node.courseId);
	}
	const assessmentSemesters = getAssessmentStageSemesters(plan);
	const warnings: Record<string, NodeWarnings> = {};
	for (const node of nodes) {
		const course = resolveCourse(node.courseId);
		warnings[node.id] = {
			// Rule groups are alternatives; warn only when all groups are missing.
			hasMissingPrerequisites:
				!!course?.prerequisites.length &&
				course.prerequisites.every((rule) =>
					rule.moduleLinkType === 'oder'
						? !rule.modules.some((id) => coursesInPlan.has(id))
						: !rule.modules.every((id) => coursesInPlan.has(id)),
				),
			hasAssessmentStageViolation:
				!!course?.assessmentLevelPassed && node.semester <= assessmentSemesters,
		};
	}
	return warnings;
}

function getAssessmentStageSemesters(plan: StudyPlan): number {
	const template = getTemplateById(plan.templateId);
	return template ? (template.modell === 'parttime' ? 3 : 2) : 0;
}

/**
 * Checks if a course requiring "assessment stage passed" is placed in assessment stage semesters.
 * Assessment stage is semesters 1-2 for full-time programs and 1-3 for part-time programs.
 */
export function hasAssessmentStageViolation(
	plan: StudyPlan,
	nodeId: string,
): boolean {
	const node = plan.nodes[nodeId];
	if (!node?.courseId) return false;

	const course = resolveCourse(node.courseId);
	if (!course?.assessmentLevelPassed) return false;

	return node.semester <= getAssessmentStageSemesters(plan);
}
