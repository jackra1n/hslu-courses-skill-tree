import type { StudyPlan } from './study-plan';
import type { Season } from './season';
import { courseStore } from '$lib/stores/courseStore.svelte';
import { progressStore, slotStatusMap } from '$lib/stores/progressStore.svelte';
import { uiStore, showCourseTypeBadges } from '$lib/stores/uiStore.svelte';
import { themeStore, theme, type Theme } from '$lib/stores/theme.svelte';
import { savePlan, loadAllPlans } from '$lib/stores/planStorage';

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
  studyPlans[courseStore.studyPlan.templateId] = courseStore.studyPlan;

  return {
    version: CURRENT_VERSION,
    currentTemplateId: courseStore.currentTemplate.id,
    start: { season: courseStore.startSeason, year: courseStore.startYear },
    studyPlans,
    slotStatus: Object.fromEntries(slotStatusMap()),
    preferences: {
      showShortNamesOnly: courseStore.showShortNamesOnly,
      showCourseTypeBadges: showCourseTypeBadges(),
      theme: theme()
    }
  };
}

export function applyAppData(data: AppData): void {
  for (const plan of Object.values(data.studyPlans)) savePlan(plan);
  courseStore.restore(
    data.currentTemplateId,
    data.start.year,
    data.start.season,
    data.preferences.showShortNamesOnly
  );
  progressStore.replaceAll(data.slotStatus);
  uiStore.setShowCourseTypeBadges(data.preferences.showCourseTypeBadges);
  themeStore.set(data.preferences.theme);
}

export function importAppData(json: string): { ok: true } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Not a valid JSON file.' };
  }

  const data = parseAppData(parsed);
  if (!data) return { ok: false, error: 'This file is not a valid skill-tree backup.' };

  applyAppData(data);
  return { ok: true };
}

function parseAppData(value: unknown): AppData | null {
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
