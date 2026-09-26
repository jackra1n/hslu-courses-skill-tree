import { browser } from '$app/environment';
import { parseStudyPlan } from '$lib/data/app-data';
import type { CurriculumTemplate } from '$lib/data/catalog/courses';
import type { Season } from '$lib/data/season';
import {
	createStudyPlan,
	normalizePlan,
	type StudyPlan,
} from '$lib/data/planning/study-plan';

const KEYS = {
	template: 'currentTemplate',
	plan: 'selectedPlan',
	shortNames: 'showShortNamesOnly',
	startSeason: 'startSeason',
	startYear: 'startYear',
	legacySelections: 'userSelections',
	planFor: (templateId: string) => `studyPlan:${templateId}`,
} as const;

function read(key: string): string | null {
	return browser ? localStorage.getItem(key) : null;
}

function write(key: string, value: string): void {
	if (browser) localStorage.setItem(key, value);
}

export function savePlan(plan: StudyPlan): void {
	try {
		write(KEYS.planFor(plan.templateId), JSON.stringify(plan));
	} catch (error) {
		console.error('Failed to persist study plan', error);
	}
}

export function loadAllPlans(): Record<string, StudyPlan> {
	if (!browser) return {};
	const plans: Record<string, StudyPlan> = {};
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (!key?.startsWith('studyPlan:')) continue;
		const stored = localStorage.getItem(key);
		if (!stored) continue;
		try {
			const parsed = parseStudyPlan(JSON.parse(stored));
			if (!parsed) continue;
			const plan = normalizePlan(parsed);
			plans[plan.templateId] = plan;
		} catch (error) {
			console.error('Failed to parse stored study plan', error);
		}
	}
	return plans;
}

// Removes every studyPlan:<templateId> key and nothing else. Used when a cloud
// snapshot or import replaces the plan set, so deleted plans cannot resurface.
export function clearAllPlans(): void {
	if (!browser) return;
	const keysToRemove: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key?.startsWith('studyPlan:')) keysToRemove.push(key);
	}
	for (const key of keysToRemove) localStorage.removeItem(key);
}

export function loadPlan(
	template: CurriculumTemplate,
	fallbackSelections: Record<string, string> = {},
): StudyPlan {
	const stored = read(KEYS.planFor(template.id));
	if (stored) {
		try {
			const parsed = parseStudyPlan(JSON.parse(stored));
			if (parsed?.templateId === template.id) {
				return normalizePlan(parsed);
			}
		} catch (error) {
			console.error('Failed to parse stored study plan', error);
		}
	}
	return createStudyPlan(template, fallbackSelections);
}

export function loadLegacySelections(): Record<string, string> {
	const stored = read(KEYS.legacySelections);
	if (!stored) return {};

	try {
		const selections = JSON.parse(stored) as Record<string, string>;
		if (browser) localStorage.removeItem(KEYS.legacySelections);
		return selections || {};
	} catch (error) {
		console.error('Failed to parse legacy user selections', error);
		return {};
	}
}

export const planPrefs = {
	saveTemplate(templateId: string, plan: string): void {
		write(KEYS.template, templateId);
		write(KEYS.plan, plan);
	},
	loadTemplateId: (): string | null => read(KEYS.template),
	loadPlanCode: (): string | null => read(KEYS.plan),
	saveStartSeason(season: Season): void {
		write(KEYS.startSeason, season);
	},
	loadStartSeason(): Season | null {
		const raw = read(KEYS.startSeason);
		return raw === 'HS' || raw === 'FS' ? raw : null;
	},
	saveStartYear(year: number): void {
		write(KEYS.startYear, String(year));
	},
	loadStartYear(): number | null {
		const raw = read(KEYS.startYear);
		const year = raw ? Number(raw) : NaN;
		return Number.isInteger(year) ? year : null;
	},
	saveShortNames(value: boolean): void {
		write(KEYS.shortNames, JSON.stringify(value));
	},
	loadShortNames(): boolean | null {
		const raw = read(KEYS.shortNames);
		if (raw === null) return null;
		try {
			const value = JSON.parse(raw);
			return typeof value === 'boolean' ? value : null;
		} catch {
			return null;
		}
	},
};
