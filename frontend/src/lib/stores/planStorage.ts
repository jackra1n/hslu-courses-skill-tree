import type { CurriculumTemplate } from '$lib/data/catalog/courses';
import type { Season } from '$lib/data/season';
import {
	createStudyPlan,
	normalizePlan,
	type StudyPlan,
} from '$lib/data/planning/study-plan';
import {
	readStorage,
	removeStorage,
	storageKeys,
	writeStorage,
} from '$lib/utils/storage';

const PLAN_PREFIX = 'studyPlan:';

const KEYS = {
	template: 'currentTemplate',
	plan: 'selectedPlan',
	shortNames: 'showShortNamesOnly',
	startSeason: 'startSeason',
	startYear: 'startYear',
	legacySelections: 'userSelections',
	planFor: (templateId: string) => `${PLAN_PREFIX}${templateId}`,
} as const;

export function savePlan(plan: StudyPlan): boolean {
	return writeStorage(KEYS.planFor(plan.templateId), JSON.stringify(plan));
}

export function loadAllPlans(): Record<string, StudyPlan> {
	const plans: Record<string, StudyPlan> = {};
	for (const key of storageKeys(PLAN_PREFIX) ?? []) {
		const stored = readStorage(key);
		if (!stored) continue;
		try {
			const plan = normalizePlan(JSON.parse(stored) as StudyPlan);
			plans[plan.templateId] = plan;
		} catch (error) {
			console.error('Failed to parse stored study plan', error);
		}
	}
	return plans;
}

export function storedPlanKeys(): string[] | null {
	return storageKeys(PLAN_PREFIX);
}

export function planKey(templateId: string): string {
	return KEYS.planFor(templateId);
}

export function replaceAllPlans(plans: StudyPlan[]): boolean {
	const stale = storedPlanKeys();
	return stale !== null && stale.every(removeStorage) && plans.every(savePlan);
}

export function loadPlan(
	template: CurriculumTemplate,
	fallbackSelections: Record<string, string> = {},
): StudyPlan {
	const stored = readStorage(KEYS.planFor(template.id));
	if (stored) {
		try {
			const parsed = normalizePlan(JSON.parse(stored) as StudyPlan);
			if (isPlanCompatible(parsed, template)) return parsed;
		} catch (error) {
			console.error('Failed to parse stored study plan', error);
		}
	}
	return createStudyPlan(template, fallbackSelections);
}

function isPlanCompatible(
	plan: StudyPlan,
	template: CurriculumTemplate,
): boolean {
	if (plan.templateId !== template.id) return false;

	const rowNodeIds = plan.rows.flatMap((row) => row.nodeOrder);
	const uniqueRowIds = new Set(rowNodeIds);
	if (uniqueRowIds.size !== rowNodeIds.length) return false;

	const nodeIds = Object.keys(plan.nodes);
	return (
		uniqueRowIds.size === nodeIds.length &&
		nodeIds.every((id) => uniqueRowIds.has(id))
	);
}

export function loadLegacySelections(): Record<string, string> {
	const stored = readStorage(KEYS.legacySelections);
	if (!stored) return {};

	try {
		const selections = JSON.parse(stored) as Record<string, string>;
		removeStorage(KEYS.legacySelections);
		return selections || {};
	} catch (error) {
		console.error('Failed to parse legacy user selections', error);
		return {};
	}
}

export const planPrefs = {
	saveTemplate(templateId: string, plan: string): boolean {
		return (
			writeStorage(KEYS.template, templateId) && writeStorage(KEYS.plan, plan)
		);
	},
	loadTemplateId: (): string | null => readStorage(KEYS.template),
	loadPlanCode: (): string | null => readStorage(KEYS.plan),
	saveStartSeason(season: Season): boolean {
		return writeStorage(KEYS.startSeason, season);
	},
	loadStartSeason(): Season | null {
		const raw = readStorage(KEYS.startSeason);
		return raw === 'HS' || raw === 'FS' ? raw : null;
	},
	saveStartYear(year: number): boolean {
		return writeStorage(KEYS.startYear, String(year));
	},
	loadStartYear(): number | null {
		const raw = readStorage(KEYS.startYear);
		const year = raw ? Number(raw) : NaN;
		return Number.isInteger(year) ? year : null;
	},
	saveShortNames(value: boolean): boolean {
		return writeStorage(KEYS.shortNames, JSON.stringify(value));
	},
	loadShortNames(): boolean | null {
		const raw = readStorage(KEYS.shortNames);
		if (raw === null) return null;
		try {
			const value = JSON.parse(raw);
			return typeof value === 'boolean' ? value : null;
		} catch {
			return null;
		}
	},
};
