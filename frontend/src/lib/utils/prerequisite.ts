import type { PrerequisiteRule } from '$lib/data/courses';
import type { StudyPlan } from '$lib/data/study-plan';
import { resolveCourse, mapPlanCourseProviders, buildPlanRowIndex } from '$lib/data/study-plan';
import { selectProviderForRule } from './graph';

type SlotStatus = Map<string, 'attended' | 'completed'>;

export function evaluatePrerequisiteRule(
  rule: PrerequisiteRule,
  slotStatus: SlotStatus,
  plan: StudyPlan
): boolean {
  const moduleResults = rule.modules.map((moduleId) => {
    const nodeIds = getNodesForCourse(plan, moduleId);
    if (nodeIds.length === 0) return false;
    return nodeIds.some((nodeId) => {
      const status = slotStatus.get(nodeId);
      if (rule.mustBePassed) {
        return status === 'completed';
      }
      return status === 'attended' || status === 'completed';
    });
  });

  if (rule.moduleLinkType === 'oder') {
    return moduleResults.some(Boolean);
  }
  return moduleResults.every(Boolean);
}

export function evaluatePrerequisites(
  rules: PrerequisiteRule[],
  slotStatus: SlotStatus,
  plan: StudyPlan
): boolean {
  if (rules.length === 0) return true;

  return rules.reduce((acc, rule, index) => {
    const current = evaluatePrerequisiteRule(rule, slotStatus, plan);
    if (index === 0) {
      return current;
    }
    const prevRule = rules[index - 1];
    const linkType = prevRule.prerequisiteLinkType || 'und';
    return linkType === 'oder' ? acc || current : acc && current;
  }, false);
}

export function hasPlanPrereqConflict(
  plan: StudyPlan,
  targetNodeId: string,
  options: { considerSameSemester?: boolean } = {}
): boolean {
  const node = plan.nodes[targetNodeId];
  if (!node?.courseId) return false;
  const course = resolveCourse(node.courseId);
  if (!course || course.prerequisites.length === 0) return false;

  const rowIndex = buildPlanRowIndex(plan);
  const providers = mapPlanCourseProviders(plan);
  const dependentRow = rowIndex[targetNodeId] ?? 0;
  const considerSameSemester = options.considerSameSemester ?? true;

  let rulesToCheck: PrerequisiteRule[];

  if (course.prerequisites.length === 0) {
    return false;
  } else if (course.prerequisites.length === 1) {
    rulesToCheck = course.prerequisites;
  } else {
    const firstRule = course.prerequisites[0];
    const prerequisiteLinkType = firstRule.prerequisiteLinkType || 'und';

    if (prerequisiteLinkType === 'oder') {
      const ruleScores = course.prerequisites.map((rule) => {
        const selectedProviders = selectProviderForRule(rule, providers, rowIndex);
        if (selectedProviders.length === 0) return Infinity;
        return Math.min(...selectedProviders.map((id) => rowIndex[id] ?? Infinity));
      });

      const bestRuleIndex = ruleScores.indexOf(Math.min(...ruleScores));
      rulesToCheck = [course.prerequisites[bestRuleIndex]];
    } else {
      rulesToCheck = course.prerequisites;
    }
  }

  const ruleConflicts = rulesToCheck.map((rule) => {
    const selectedProviders = selectProviderForRule(rule, providers, rowIndex);

    if (selectedProviders.length === 0) return true;

    return selectedProviders.some((providerId) => {
      const providerRow = rowIndex[providerId] ?? 0;
      return considerSameSemester ? providerRow >= dependentRow : providerRow > dependentRow;
    });
  });

  if (ruleConflicts.length === 1) return ruleConflicts[0];

  return ruleConflicts.some((conflict) => conflict);
}

function getNodesForCourse(plan: StudyPlan, courseId: string): string[] {
  return Object.values(plan.nodes)
    .filter((node) => node.courseId === courseId)
    .map((node) => node.id);
}
