import { browser } from '$app/environment';
import { isPlanCustomized } from '$lib/data/planning/plan-rules';
import * as m from '$lib/paraglide/messages';
import { getCourseStore } from '$lib/stores/courseStore.svelte';
import { loadAllPlans, replaceAllPlans } from '$lib/stores/planStorage';
import { progressStore } from '$lib/stores/progressStore.svelte';
import { uiStore } from '$lib/stores/uiStore.svelte';
import { readStorage } from '$lib/utils/storage';
import type { Season } from './season';
import type { StudyPlan } from './planning/study-plan';

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
	};
};

// Record insertion order is not a change; array order (such as semester rows) is.
export function serializeSnapshot(snapshot: object): string {
	return JSON.stringify(snapshot, (_key, value: unknown) => {
		if (value === null || typeof value !== 'object' || Array.isArray(value)) {
			return value;
		}
		const record = value as Record<string, unknown>;
		return Object.fromEntries(
			Object.keys(record)
				.sort()
				.map((key) => [key, record[key]]),
		);
	});
}

export function collectAppData(): AppData {
	const studyPlans = loadAllPlans();
	const store = getCourseStore();
	studyPlans[store.studyPlan.templateId] = store.studyPlan;

	return {
		version: CURRENT_VERSION,
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
	if (!replaceAllPlans(Object.values(data.studyPlans))) {
		throw new Error('Could not store study plans');
	}
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

	try {
		applyAppData(data);
	} catch (error) {
		console.error('Failed to import app data', error);
		return { ok: false, error: m.persistence_storage_failed() };
	}
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
	// Older snapshots included theme; device-local preferences never enter sync.
	return {
		...(data as AppData),
		preferences: {
			showShortNamesOnly: data.preferences.showShortNamesOnly,
			showCourseTypeBadges: data.preferences.showCourseTypeBadges,
		},
	};
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

	const slotStatusRaw = readStorage('slotStatus');
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
