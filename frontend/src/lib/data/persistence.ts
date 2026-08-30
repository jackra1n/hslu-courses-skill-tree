import * as messages from '$lib/paraglide/messages';
import { browser } from '$app/environment';
import { isPlanCustomized } from '$lib/data/plan-rules';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import { clearAllPlans, loadAllPlans, savePlan } from '$lib/stores/planStorage';
import { progressStore, slotStatusMap } from '$lib/stores/progressStore.svelte';
import { type Theme, theme, themeStore } from '$lib/stores/theme.svelte';
import { showCourseTypeBadges, uiStore } from '$lib/stores/uiStore.svelte';
import type { Season } from './season';
import type { StudyPlan } from './study-plan';

const CURRENT_VERSION = 1;

export type AppData = {
	version: number;
	currentTemplateId: string;
	start: { season: Season; year: number };
	studyPlans: Record<string, StudyPlan>;
	slotStatus: Record<string, 'attended' | 'completed'>;
	preferences: {
		showShortNamesOnly: boolean;
		showCourseTypeBadges: boolean;
		theme: Theme;
	};
};

export function collectAppData(): AppData {
	const studyPlans = loadAllPlans();
	const store = getCourseStore();
	studyPlans[store.studyPlan.templateId] = store.studyPlan;

	return {
		version: CURRENT_VERSION,
		currentTemplateId: store.currentTemplate.id,
		start: { season: store.startSeason, year: store.startYear },
		studyPlans,
		slotStatus: Object.fromEntries(slotStatusMap()),
		preferences: {
			showShortNamesOnly: store.showShortNamesOnly,
			showCourseTypeBadges: showCourseTypeBadges(),
			theme: theme(),
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
	themeStore.set(data.preferences.theme);
}

export function importAppData(
	json: string,
): { ok: true } | { ok: false; error: string } {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return { ok: false, error: messages.persistence_invalid_json() };
	}

	const data = parseAppData(parsed);
	if (!data)
		return { ok: false, error: messages.persistence_invalid_backup() };

	applyAppData(data);
	return { ok: true };
}

export function parseAppData(value: unknown): AppData | null {
	if (!value || typeof value !== 'object') return null;
	const data = value as Partial<AppData>;
	if (data.version !== CURRENT_VERSION) return null; // future: migrate older versions here
	if (typeof data.currentTemplateId !== 'string') return null;
	if (!data.start || typeof data.start.year !== 'number') return null;
	if (!data.studyPlans || typeof data.studyPlans !== 'object') return null;
	if (!data.slotStatus || typeof data.slotStatus !== 'object') return null;
	if (!data.preferences || typeof data.preferences !== 'object') return null;
	return data as AppData;
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
	'theme',
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
