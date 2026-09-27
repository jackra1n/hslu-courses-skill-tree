import { browser } from '$app/environment';
import { isPlanCustomized } from '$lib/data/planning/plan-rules';
import * as m from '$lib/paraglide/messages';
import { canvasCommands } from '$lib/stores/canvasCommands.svelte';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import { loadAllPlans, replaceAllPlans, storedPlanKeys } from '$lib/stores/planStorage';
import { progressStore } from '$lib/stores/progressStore.svelte';
import { uiStore } from '$lib/stores/uiStore.svelte';
import { backupStorage, readStorage, restoreStorage, STORAGE_KEYS } from '$lib/utils/storage';
import { APP_DATA_VERSION, type AppData, parseAppData } from './app-data';

export function collectAppData(): AppData {
	const studyPlans = loadAllPlans();
	const store = getCourseStore();
	studyPlans[store.studyPlan.templateId] = store.studyPlan;

	return {
		version: APP_DATA_VERSION,
		currentTemplateId: store.currentTemplate.id,
		start: { season: store.startSeason, year: store.startYear },
		studyPlans,
		slotStatus: Object.fromEntries(progressStore.slotStatus),
		preferences: {
			showShortNamesOnly: store.showShortNamesOnly,
			showCourseTypeBadges: uiStore.showCourseTypeBadges,
		},
	};
}

function requirePersisted(saved: boolean, what: string): void {
	if (!saved) throw new Error(`Could not store ${what}`);
}

export function applyAppData(data: AppData): void {
	const plans = Object.values(data.studyPlans);
	const storedPlanKeysBefore = storedPlanKeys();
	const backup =
		storedPlanKeysBefore &&
		backupStorage([
			...storedPlanKeysBefore,
			...plans.map((plan) => STORAGE_KEYS.planFor(plan.templateId)),
			...MEANINGFUL_KEYS,
			STORAGE_KEYS.slotStatus,
		]);
	if (!backup) throw new Error('Could not back up stored app data');
	const store = getCourseStore();
	const live = {
		course: store.captureState(),
		progress: progressStore.captureState(),
		ui: uiStore.captureState(),
	};

	try {
		requirePersisted(replaceAllPlans(plans), 'study plans');
		requirePersisted(
			store.restore(data.currentTemplateId, data.start.year, data.start.season, data.preferences.showShortNamesOnly),
			'plan preferences',
		);
		requirePersisted(progressStore.replaceAll(data.slotStatus), 'progress');
		requirePersisted(uiStore.setShowCourseTypeBadges(data.preferences.showCourseTypeBadges), 'preferences');
	} catch (error) {
		if (!restoreStorage(backup)) {
			console.error('Could not restore stored app data after a failed apply');
		}
		store.restoreState(live.course);
		progressStore.restoreState(live.progress);
		uiStore.restoreState(live.ui);
		throw error;
	}
	// A replaced plan can reuse a selected slot id for another course or move
	// nodes outside the viewport fitted on mount.
	uiStore.deselectCourse();
	void canvasCommands.current?.fitView();
}

export function importAppData(json: string): { ok: true } | { ok: false; error: string } {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return { ok: false, error: m.persistence_invalid_json() };
	}

	const data = parseAppData(parsed);
	if (!data) return { ok: false, error: m.persistence_invalid_backup() };

	try {
		applyAppData(data);
	} catch (error) {
		console.error('Failed to import app data', error);
		return { ok: false, error: m.persistence_storage_failed() };
	}
	return { ok: true };
}

// True when local storage holds real user state beyond an untouched default
// plan: any slot status, any customized plan, or any explicit preference key.
// Called before store initialization, so it only reads raw storage.
const MEANINGFUL_KEYS = [
	STORAGE_KEYS.template,
	STORAGE_KEYS.plan,
	STORAGE_KEYS.shortNames,
	STORAGE_KEYS.startSeason,
	STORAGE_KEYS.startYear,
	STORAGE_KEYS.courseTypeBadges,
];

export function hasMeaningfulStoredAppData(): boolean {
	if (!browser) return false;

	const slotStatusRaw = readStorage(STORAGE_KEYS.slotStatus);
	if (slotStatusRaw) {
		try {
			const statuses = JSON.parse(slotStatusRaw) as Record<string, unknown>;
			if (Object.keys(statuses).length > 0) return true;
		} catch {
			// corrupt status storage: fall through to other signals
		}
	}

	for (const plan of Object.values(loadAllPlans())) {
		if (isPlanCustomized(plan)) return true;
	}

	return MEANINGFUL_KEYS.some((key) => readStorage(key) !== null);
}
