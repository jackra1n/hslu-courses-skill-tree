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
  subcategories?: CategoryProgress[];
};

type Tally = { passed: number; planned: number; failed: number };

// Major/Minor modules are a kind of Erweiterungsmodul, so they roll up into it.
const TOP_LEVEL: ModuleType[] = ['Kernmodul', 'Projektmodul', 'Erweiterungsmodul', 'Zusatzmodul'];

export function computeCategoryProgress(
  plan: StudyPlan,
  slotStatus: Map<string, 'attended' | 'completed'>,
  program: string
): CategoryProgress[] {
  const requirements = getEctsRequirements(program);
  const totals = new Map<ModuleType, Tally>();

  for (const node of Object.values(plan.nodes)) {
    const course = resolveCourse(node.courseId);
    if (!course?.type) continue;

    const bucket = totals.get(course.type) ?? { passed: 0, planned: 0, failed: 0 };
    const status = slotStatus.get(node.id);
    const field = status === 'completed' ? 'passed' : status === 'attended' ? 'failed' : 'planned';
    bucket[field] += course.ects || 0;
    totals.set(course.type, bucket);
  }

  const tallyOf = (category: ModuleType): Tally =>
    totals.get(category) ?? { passed: 0, planned: 0, failed: 0 };
  const requiredOf = (category: ModuleType) => requirements?.perModule[category] ?? 0;

  return TOP_LEVEL.map((category) => {
    if (category !== 'Erweiterungsmodul') {
      return { category, required: requiredOf(category), ...tallyOf(category) };
    }

    const extension = tallyOf('Erweiterungsmodul');
    const majorMinor = tallyOf('Major-/Minormodul');
    return {
      category,
      required: requiredOf('Erweiterungsmodul'),
      passed: extension.passed + majorMinor.passed,
      planned: extension.planned + majorMinor.planned,
      failed: extension.failed + majorMinor.failed,
      subcategories: [
        { category: 'Major-/Minormodul', required: requiredOf('Major-/Minormodul'), ...majorMinor }
      ]
    };
  });
}
