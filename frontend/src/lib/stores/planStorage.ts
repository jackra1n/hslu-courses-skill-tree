import { browser } from '$app/environment';
import type { CurriculumTemplate } from '$lib/data/courses';
import type { Season } from '$lib/data/season';
import { createStudyPlan, normalizePlan, type StudyPlan } from '$lib/data/study-plan';

const KEYS = {
  template: 'currentTemplate',
  plan: 'selectedPlan',
  shortNames: 'showShortNamesOnly',
  startSeason: 'startSeason',
  startYear: 'startYear',
  legacySelections: 'userSelections',
  planFor: (templateId: string) => `studyPlan:${templateId}`
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

export function loadPlan(
  template: CurriculumTemplate,
  fallbackSelections: Record<string, string> = {}
): StudyPlan {
  const stored = read(KEYS.planFor(template.id));
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

function isPlanCompatible(plan: StudyPlan, template: CurriculumTemplate): boolean {
  if (plan.templateId !== template.id) return false;

  const rowNodeIds = plan.rows.flatMap((row) => row.nodeOrder);
  const uniqueRowIds = new Set(rowNodeIds);
  if (uniqueRowIds.size !== rowNodeIds.length) return false;

  const nodeIds = Object.keys(plan.nodes);
  return uniqueRowIds.size === nodeIds.length && nodeIds.every((id) => uniqueRowIds.has(id));
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
  }
};
