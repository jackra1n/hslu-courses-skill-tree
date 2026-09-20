import { browser } from '$app/environment';
import type { Course } from '../types';

let _selection = $state<Course | null>(null);
let _selectedSlotId = $state<string | null>(null);
let _showAssessmentInfo = $state(false);
let _showCourseTypeBadges = $state(false);
let _tutorialRequested = $state(false);
let _tutorialNavigationOpen = $state(false);

const _hasSelection = $derived(_selection !== null);
const _isElectiveSlot = $derived(
	_selection?.id.startsWith('elective') ||
		_selection?.id.startsWith('major') ||
		_selection?.id.startsWith('custom-') ||
		false,
);

export function selection() {
	return _selection;
}
export function selectedSlotId() {
	return _selectedSlotId;
}
export function showAssessmentInfo() {
	return _showAssessmentInfo;
}
export function showCourseTypeBadges() {
	return _showCourseTypeBadges;
}
export function tutorialRequested() {
	return _tutorialRequested;
}
export function tutorialNavigationOpen() {
	return _tutorialNavigationOpen;
}
export function hasSelection() {
	return _hasSelection;
}
export function isElectiveSlot() {
	return _isElectiveSlot;
}

export const uiStore = {
	selectCourse(course: Course | null, slotId?: string | null) {
		_selection = course;
		_selectedSlotId = slotId || null;
	},

	deselectCourse() {
		_selection = null;
		_selectedSlotId = null;
	},

	toggleAssessmentInfo() {
		_showAssessmentInfo = !_showAssessmentInfo;
	},

	toggleCourseTypeBadges() {
		this.setShowCourseTypeBadges(!_showCourseTypeBadges);
	},

	setShowCourseTypeBadges(value: boolean) {
		_showCourseTypeBadges = value;
		if (browser) {
			localStorage.setItem(
				'showCourseTypeBadges',
				JSON.stringify(_showCourseTypeBadges),
			);
		}
	},

	requestTutorial() {
		_tutorialRequested = true;
	},

	consumeTutorialRequest() {
		_tutorialRequested = false;
	},

	setTutorialNavigationOpen(value: boolean) {
		_tutorialNavigationOpen = value;
	},

	init() {
		if (!browser) return;

		const savedShowCourseTypeBadges = localStorage.getItem(
			'showCourseTypeBadges',
		);
		if (savedShowCourseTypeBadges) {
			_showCourseTypeBadges = JSON.parse(savedShowCourseTypeBadges);
		}
	},
};
