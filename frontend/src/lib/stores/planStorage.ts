import { browser } from '$app/environment';
import type { CurriculumTemplate } from '$lib/data/courses';
import { createStudyPlan, normalizePlan, type StudyPlan } from '$lib/data/study-plan';

const KEYS = {
  template: 'currentTemplate',
  plan: 'selectedPlan',
  shortNames: 'showShortNamesOnly',
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
  if (rowNodeIds.length !== Object.keys(plan.nodes).length) return false;
  return rowNodeIds.every((nodeId) => plan.nodes[nodeId]);
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
  saveShortNames(value: boolean): void {
    write(KEYS.shortNames, JSON.stringify(value));
  },
  loadShortNames(): boolean | null {
    const raw = read(KEYS.shortNames);
    return raw ? JSON.parse(raw) : null;
  }
};
