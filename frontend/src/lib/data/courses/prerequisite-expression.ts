import type { PrerequisiteRule } from '../catalog/catalog-types';

export type PrerequisiteExpression =
	| { ruleIndex: number }
	| { operator: 'and' | 'or'; children: PrerequisiteExpression[] };

export function buildPrerequisiteExpression(
	rules: readonly PrerequisiteRule[],
): PrerequisiteExpression | null {
	if (rules.length === 0) return null;

	let expression: PrerequisiteExpression = { ruleIndex: 0 };
	for (let ruleIndex = 1; ruleIndex < rules.length; ruleIndex++) {
		const operator =
			rules[ruleIndex - 1].prerequisiteLinkType === 'oder' ? 'or' : 'and';
		const child: PrerequisiteExpression = { ruleIndex };
		// the evaluator folds left-to-right; only identical operators are associative.
		if ('operator' in expression && expression.operator === operator) {
			expression.children.push(child);
		} else {
			expression = { operator, children: [expression, child] };
		}
	}
	return expression;
}
