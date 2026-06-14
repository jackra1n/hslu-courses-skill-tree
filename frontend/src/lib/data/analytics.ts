import type { StudyPlan } from './study-plan';
import { resolveCourse } from './study-plan';
import type { ModuleType } from './courses';
import { getEctsRequirements } from './ects-requirements';

export type CategoryProgress = {
  category: ModuleType;
  required: number;
  passed: number;
  planned: number;
  failed: number;
};

const CATEGORY_ORDER: ModuleType[] = [
  'Kernmodul',
  'Projektmodul',
  'Erweiterungsmodul',
  'Major-/Minormodul',
  'Zusatzmodul'
];

export function computeCategoryProgress(
  plan: StudyPlan,
  slotStatus: Map<string, 'attended' | 'completed'>,
  program: string
): CategoryProgress[] {
  const requirements = getEctsRequirements(program);
  const totals = new Map<ModuleType, { passed: number; planned: number; failed: number }>();

  for (const node of Object.values(plan.nodes)) {
    const course = resolveCourse(node.courseId);
    if (!course?.type) continue;

    const bucket = totals.get(course.type) ?? { passed: 0, planned: 0, failed: 0 };
    const status = slotStatus.get(node.id);
    const field = status === 'completed' ? 'passed' : status === 'attended' ? 'failed' : 'planned';
    bucket[field] += course.ects || 0;
    totals.set(course.type, bucket);
  }

  return CATEGORY_ORDER.map((category) => ({
    category,
    required: requirements?.perModule[category] ?? 0,
    ...(totals.get(category) ?? { passed: 0, planned: 0, failed: 0 })
  }));
}
