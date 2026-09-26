import { browser } from '$app/environment';
import { isPlanCustomized } from '$lib/data/planning/plan-rules';
import * as m from '$lib/paraglide/messages';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import { clearAllPlans, loadAllPlans, savePlan } from '$lib/stores/planStorage';
import { progressStore } from '$lib/stores/progressStore.svelte';
import { uiStore } from '$lib/stores/uiStore.svelte';
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

export function applyAppData(data: AppData): void {
	// Replace stale plans so removed plans never resurface on the next upload.
	clearAllPlans();
	for (const plan of Object.values(data.studyPlans)) savePlan(plan);
	getCourseStore().restore(
		data.currentTemplateId,
		data.start.year,
		data.start.season,
		data.preferences.showShortNamesOnly,
	);
	progressStore.replaceAll(data.slotStatus);
	uiStore.setShowCourseTypeBadges(data.preferences.showCourseTypeBadges);
}

export function importAppData(
	json: string,
): { ok: true } | { ok: false; error: string } {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return { ok: false, error: m.persistence_invalid_json() };
	}

	const data = parseAppData(parsed);
	if (!data) return { ok: false, error: m.persistence_invalid_backup() };

	applyAppData(data);
	return { ok: true };
}

// True when local storage holds real user state beyond an untouched default
// plan: any slot status, any customized plan, or any explicit preference key.
// Called before store initialization, so it only reads raw storage.
const MEANINGFUL_KEYS = [
	'currentTemplate',
	'selectedPlan',
	'showShortNamesOnly',
	'startSeason',
	'startYear',
	'showCourseTypeBadges',
] as const;

export function hasMeaningfulStoredAppData(): boolean {
	if (!browser) return false;

	const slotStatusRaw = localStorage.getItem('slotStatus');
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

	return MEANINGFUL_KEYS.some((key) => localStorage.getItem(key) !== null);
}
