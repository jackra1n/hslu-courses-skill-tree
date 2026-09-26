import { browser } from '$app/environment';
import type { StudyPlan } from '$lib/data/planning/study-plan';
import { resolveCourse } from '$lib/data/planning/study-plan';
import { evaluatePrerequisites } from '$lib/utils/prerequisite';
import { getAssessmentStageProgress } from '$lib/utils/status';
import { readStorage, writeStorage } from '$lib/utils/storage';

type SlotStatus = 'attended' | 'completed';

function parseSlotStatuses(value: unknown): Map<string, SlotStatus> {
	const statuses = new Map<string, SlotStatus>();
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return statuses;
	}

	for (const [slotId, status] of Object.entries(value)) {
		if (status === 'attended' || status === 'completed') {
			statuses.set(slotId, status);
		}
	}
	return statuses;
}

class ProgressStore {
	private statuses = $state(new Map<string, SlotStatus>());

	get slotStatus(): Map<string, SlotStatus> {
		return this.statuses;
	}

	private saveToLocalStorage() {
		writeStorage(
			'slotStatus',
			JSON.stringify(Object.fromEntries(this.statuses)),
		);
	}

	private toggleSlotStatus(slotId: string, status: SlotStatus | null) {
		const statuses = new Map(this.statuses);
		if (status === null || statuses.get(slotId) === status) {
			statuses.delete(slotId);
		} else {
			statuses.set(slotId, status);
		}
		this.statuses = statuses;
		this.saveToLocalStorage();
	}

	markSlotAttended(slotId: string) {
		this.toggleSlotStatus(slotId, 'attended');
	}

	markSlotCompleted(slotId: string) {
		this.toggleSlotStatus(slotId, 'completed');
	}

	clearSlotStatus(slotId: string) {
		this.toggleSlotStatus(slotId, null);
	}

	getSlotStatus(slotId: string): SlotStatus | null {
		return this.statuses.get(slotId) ?? null;
	}

	replaceAll(status: unknown) {
		this.statuses = parseSlotStatuses(status);
		this.saveToLocalStorage();
	}

	hasCompletedInstance(courseId: string, plan: StudyPlan): boolean {
		return getNodeIdsForCourse(plan, courseId).some(
			(slotId) => this.statuses.get(slotId) === 'completed',
		);
	}

	hasAttendedInstance(courseId: string, plan: StudyPlan): boolean {
		const nodeIds = getNodeIdsForCourse(plan, courseId);
		const hasCurrentAttended = nodeIds.some(
			(slotId) => this.statuses.get(slotId) === 'attended',
		);
		if (hasCurrentAttended) return true;

		const potentialSlotId = courseId.toLowerCase();
		return this.statuses.get(potentialSlotId) === 'attended';
	}

	getAllInstanceStatuses(
		courseId: string,
		plan: StudyPlan,
	): Array<{ slotId: string; status: SlotStatus }> {
		return getNodeIdsForCourse(plan, courseId)
			.map((slotId) => {
				const status = this.statuses.get(slotId);
				return status ? { slotId, status } : null;
			})
			.filter(
				(item): item is { slotId: string; status: SlotStatus } => item !== null,
			);
	}

	canTakeCourse(courseId: string, plan: StudyPlan): boolean {
		const course = resolveCourse(courseId);
		if (!course) return false;

		const prereqsMet = evaluatePrerequisites(
			course.prerequisites,
			this.statuses,
			plan,
		);
		const assessmentStageMet = getAssessmentStageProgress(
			plan,
			this.statuses,
		).passed;
		const assessmentMet = !course.assessmentLevelPassed || assessmentStageMet;

		return prereqsMet && assessmentMet;
	}

	init() {
		if (!browser) return;

		this.statuses = new Map();
		try {
			const savedSlotStatus = readStorage('slotStatus');
			if (savedSlotStatus !== null) {
				this.statuses = parseSlotStatuses(JSON.parse(savedSlotStatus));
			}
		} catch (e) {
			console.error('Failed to load slotStatus from localStorage', e);
		}
	}
}

export const progressStore = new ProgressStore();

function getNodeIdsForCourse(plan: StudyPlan, courseId: string): string[] {
	return Object.values(plan.nodes)
		.filter((node) => node.courseId === courseId)
		.map((node) => node.id);
}
