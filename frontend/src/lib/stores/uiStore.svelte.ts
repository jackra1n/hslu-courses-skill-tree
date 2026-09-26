import { readStorage, writeStorage } from '$lib/utils/storage';
import type { Course } from '../types';

class UIStore {
	selection = $state<Course | null>(null);
	selectedSlotId = $state<string | null>(null);
	showAssessmentInfo = $state(false);
	tutorialRequested = $state(false);
	tutorialNavigationOpen = $state(false);
	private courseTypeBadges = $state(false);

	hasSelection = $derived(this.selection !== null);
	isElectiveSlot = $derived(
		this.selection?.id.startsWith('elective') ||
			this.selection?.id.startsWith('major') ||
			this.selection?.id.startsWith('custom-') ||
			false,
	);

	get showCourseTypeBadges() {
		return this.courseTypeBadges;
	}

	selectCourse(course: Course | null, slotId?: string | null) {
		this.selection = course;
		this.selectedSlotId = slotId || null;
	}

	deselectCourse() {
		this.selectCourse(null);
	}

	toggleCourseTypeBadges() {
		this.setShowCourseTypeBadges(!this.courseTypeBadges);
	}

	setShowCourseTypeBadges(value: boolean): boolean {
		this.courseTypeBadges = value;
		return writeStorage('showCourseTypeBadges', JSON.stringify(value));
	}

	init() {
		this.courseTypeBadges = readStorage('showCourseTypeBadges') === 'true';
	}
}

export const uiStore = new UIStore();
