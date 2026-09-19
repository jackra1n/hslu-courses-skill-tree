import { describe, expect, test } from 'bun:test';
import type { PrerequisiteRule } from '../src/lib/data/catalog-types';
import { summarizePrerequisites } from '../src/lib/data/prerequisite-summary';
import type { PlanNode, StudyPlan } from '../src/lib/data/study-plan';

function node(id: string, courseId: string | null, semester = 1): PlanNode {
	return {
		id,
		courseId,
		semester,
		kind: 'custom',
		slotType: 'custom',
		ects: 3,
		label: courseId ?? 'Empty slot',
	};
}

function plan(...nodes: PlanNode[]): StudyPlan {
	const rows = new Map<number, string[]>();
	for (const entry of nodes) {
		const ids = rows.get(entry.semester) ?? [];
		ids.push(entry.id);
		rows.set(entry.semester, ids);
	}
	return {
		templateId: 'test',
		planCode: 'HS26',
		rows: [...rows.entries()]
			.sort(([left], [right]) => left - right)
			.map(([semester, nodeOrder]) => ({ semester, nodeOrder })),
		nodes: Object.fromEntries(nodes.map((entry) => [entry.id, entry])),
	};
}

function rule(
	modules: string[],
	options: Partial<Omit<PrerequisiteRule, 'modules'>> = {},
): PrerequisiteRule {
	return { modules, mustBePassed: false, moduleLinkType: 'und', ...options };
}

const noProgress = new Map<string, 'attended' | 'completed'>();

describe('summarizePrerequisites', () => {
	test('a satisfied OR shows every satisfying member and no unused alternatives', () => {
		const result = summarizePrerequisites(
			[rule(['A', 'B', 'C', 'D'], { moduleLinkType: 'oder' })],
			plan(node('a', 'A'), node('b', 'B'), node('c', 'C')),
			new Map([
				['a', 'attended'],
				['b', 'completed'],
			]),
		);

		expect(result).toEqual([
			{
				ruleIndex: 0,
				state: 'satisfied',
				relevant: true,
				courses: [
					{ courseId: 'A', state: 'attended', semesters: [1] },
					{ courseId: 'B', state: 'completed', semesters: [1] },
				],
			},
		]);
	});

	test('an unfulfilled OR keeps all planned candidates without missing unused alternatives', () => {
		const result = summarizePrerequisites(
			[rule(['A', 'B', 'C'], { moduleLinkType: 'oder' })],
			plan(node('a', 'A'), node('b', 'B', 2)),
			noProgress,
		);

		expect(result[0].state).toBe('planned');
		expect(result[0].courses).toEqual([
			{ courseId: 'A', state: 'planned', semesters: [1] },
			{ courseId: 'B', state: 'planned', semesters: [2] },
		]);
	});

	test('an absent OR is one missing group containing all alternatives', () => {
		expect(
			summarizePrerequisites(
				[rule(['A', 'B'], { moduleLinkType: 'oder' })],
				plan(node('target', 'TARGET')),
				noProgress,
			),
		).toEqual([
			{
				ruleIndex: 0,
				state: 'missing',
				relevant: true,
				courses: [
					{ courseId: 'A', state: 'missing', semesters: [] },
					{ courseId: 'B', state: 'missing', semesters: [] },
				],
			},
		]);
	});

	test('AND keeps missing members visible even when another member is completed', () => {
		const result = summarizePrerequisites(
			[rule(['A', 'B'])],
			plan(node('a', 'A')),
			new Map([['a', 'completed']]),
		);

		expect(result[0].state).toBe('missing');
		expect(result[0].courses).toEqual([
			{ courseId: 'A', state: 'completed', semesters: [1] },
			{ courseId: 'B', state: 'missing', semesters: [] },
		]);
	});

	test('planning is not attendance and attendance is not passing', () => {
		const rules = [rule(['A']), rule(['A'], { mustBePassed: true })];
		const studyPlan = plan(node('a', 'A'));
		const states = (statuses: Map<string, 'attended' | 'completed'>) =>
			summarizePrerequisites(rules, studyPlan, statuses).map((entry) => ({
				group: entry.state,
				course: entry.courses[0].state,
			}));

		expect(states(noProgress)).toEqual([
			{ group: 'planned', course: 'planned' },
			{ group: 'planned', course: 'planned' },
		]);
		expect(states(new Map([['a', 'attended']]))).toEqual([
			{ group: 'satisfied', course: 'attended' },
			{ group: 'incomplete', course: 'incomplete' },
		]);
		expect(states(new Map([['a', 'completed']]))).toEqual([
			{ group: 'satisfied', course: 'completed' },
			{ group: 'satisfied', course: 'completed' },
		]);
	});

	test('a completed instance beats incomplete repeats and reports distinct semesters', () => {
		const studyPlan = plan(
			node('repeat', 'A', 3),
			node('passed', 'A', 1),
			node('another-repeat', 'A', 3),
			node('target', 'TARGET', 2),
		);
		const result = summarizePrerequisites(
			[rule(['A'], { mustBePassed: true })],
			studyPlan,
			new Map([
				['repeat', 'attended'],
				['passed', 'completed'],
			]),
			'target',
		);

		expect(result[0].state).toBe('satisfied');
		expect(result[0].courses).toEqual([
			{ courseId: 'A', state: 'completed', semesters: [1, 3] },
		]);
	});

	test('same-row and earlier instances are feasible but exclusively later placement is not', () => {
		const studyPlan = plan(
			node('a-later', 'A', 3),
			node('a-earlier', 'A', 1),
			node('b-same', 'B', 2),
			node('c-later', 'C', 3),
			node('target', 'TARGET', 2),
		);
		const result = summarizePrerequisites(
			[rule(['A', 'B', 'C'])],
			studyPlan,
			noProgress,
			'target',
		);

		expect(result[0].state).toBe('later');
		expect(result[0].courses).toEqual([
			{ courseId: 'A', state: 'planned', semesters: [1, 3] },
			{ courseId: 'B', state: 'planned', semesters: [2] },
			{ courseId: 'C', state: 'later', semesters: [3] },
		]);
		expect(
			summarizePrerequisites([rule(['C'])], studyPlan, noProgress)[0].state,
		).toBe('planned');
		expect(
			summarizePrerequisites(
				[rule(['C'])],
				studyPlan,
				noProgress,
				'unknown-target',
			)[0].state,
		).toBe('planned');
	});

	test('satisfying progress overrides later placement and OR retains feasible choices', () => {
		const studyPlan = plan(
			node('target', 'TARGET', 1),
			node('a', 'A', 2),
			node('b', 'B', 2),
			node('c', 'C', 1),
		);
		const result = summarizePrerequisites(
			[rule(['A']), rule(['B'], { mustBePassed: true })],
			studyPlan,
			new Map([
				['a', 'attended'],
				['b', 'completed'],
			]),
			'target',
		);
		expect(result.map((entry) => entry.state)).toEqual([
			'satisfied',
			'satisfied',
		]);

		const alternatives = summarizePrerequisites(
			[rule(['A', 'C'], { moduleLinkType: 'oder' })],
			studyPlan,
			noProgress,
			'target',
		);
		expect(alternatives[0].state).toBe('planned');
		expect(alternatives[0].courses).toEqual([
			{ courseId: 'A', state: 'later', semesters: [2] },
			{ courseId: 'C', state: 'planned', semesters: [1] },
		]);
	});

	test('uses actual row order rather than semester labels for known placement', () => {
		const studyPlan = plan(node('a', 'A', 1), node('target', 'TARGET', 2));
		studyPlan.rows.reverse();
		expect(
			summarizePrerequisites([rule(['A'])], studyPlan, noProgress, 'target')[0]
				.state,
		).toBe('later');
	});

	test('null and course-free plans keep every requirement neutral', () => {
		const rules = [
			rule(['A', 'B'], {
				moduleLinkType: 'oder',
				prerequisiteLinkType: 'oder',
			}),
			rule(['C']),
		];
		const expected = [
			{
				ruleIndex: 0,
				state: 'required',
				relevant: true,
				courses: [
					{ courseId: 'A', state: 'required', semesters: [] },
					{ courseId: 'B', state: 'required', semesters: [] },
				],
			},
			{
				ruleIndex: 1,
				state: 'required',
				relevant: true,
				courses: [{ courseId: 'C', state: 'required', semesters: [] }],
			},
		];
		expect(summarizePrerequisites(rules, null, noProgress)).toEqual(expected);
		expect(
			summarizePrerequisites(rules, plan(node('empty', null)), noProgress),
		).toEqual(expected);
	});

	test('inter-rule OR prefers satisfied branches without choosing between equally satisfied ones', () => {
		const result = summarizePrerequisites(
			[
				rule(['A'], { prerequisiteLinkType: 'oder' }),
				rule(['B'], { prerequisiteLinkType: 'oder' }),
				rule(['C']),
			],
			plan(node('a', 'A'), node('b', 'B'), node('c', 'C')),
			new Map([
				['a', 'completed'],
				['c', 'attended'],
			]),
		);

		expect(
			result.map(({ ruleIndex, state, relevant }) => ({
				ruleIndex,
				state,
				relevant,
			})),
		).toEqual([
			{ ruleIndex: 0, state: 'satisfied', relevant: true },
			{ ruleIndex: 1, state: 'planned', relevant: false },
			{ ruleIndex: 2, state: 'satisfied', relevant: true },
		]);
	});

	test('inter-rule OR keeps all fully planned branches and omits infeasible alternatives', () => {
		const result = summarizePrerequisites(
			[
				rule(['A'], { prerequisiteLinkType: 'oder' }),
				rule(['B', 'MISSING'], { prerequisiteLinkType: 'oder' }),
				rule(['C'], { prerequisiteLinkType: 'oder' }),
				rule(['D']),
			],
			plan(
				node('a', 'A'),
				node('b', 'B'),
				node('c', 'C'),
				node('d', 'D', 3),
				node('target', 'TARGET', 2),
			),
			noProgress,
			'target',
		);

		expect(result.map((entry) => entry.relevant)).toEqual([
			true,
			false,
			true,
			false,
		]);
		expect(result.map((entry) => entry.state)).toEqual([
			'planned',
			'missing',
			'planned',
			'later',
		]);
	});

	test('inter-rule OR retains all alternatives if none are satisfied or feasible', () => {
		const result = summarizePrerequisites(
			[
				rule(['A'], { prerequisiteLinkType: 'oder' }),
				rule(['B'], { mustBePassed: true, prerequisiteLinkType: 'oder' }),
				rule(['C']),
			],
			plan(node('b', 'B'), node('c', 'C', 3), node('target', 'TARGET', 2)),
			new Map([['b', 'attended']]),
			'target',
		);

		expect(result.map((entry) => entry.relevant)).toEqual([true, true, true]);
		expect(result.map((entry) => entry.state)).toEqual([
			'missing',
			'incomplete',
			'later',
		]);
	});

	test('mixed links mean (A OR B) AND C, so a missing C is never pruned', () => {
		const result = summarizePrerequisites(
			[
				rule(['A'], { prerequisiteLinkType: 'oder' }),
				rule(['B'], { prerequisiteLinkType: 'und' }),
				rule(['C']),
			],
			plan(node('a', 'A')),
			new Map([['a', 'completed']]),
		);

		expect(
			result.filter((entry) => entry.relevant).map((entry) => entry.ruleIndex),
		).toEqual([0, 2]);
		expect(result[2].state).toBe('missing');
	});

	test('a feasible final OR branch supersedes an incomplete left-to-right expression', () => {
		const result = summarizePrerequisites(
			[
				rule(['A'], { prerequisiteLinkType: 'oder' }),
				rule(['B'], { prerequisiteLinkType: 'und' }),
				rule(['C'], { prerequisiteLinkType: 'oder' }),
				rule(['D']),
			],
			plan(node('a', 'A'), node('d', 'D')),
			new Map([['a', 'completed']]),
		);

		expect(
			result.filter((entry) => entry.relevant).map((entry) => entry.ruleIndex),
		).toEqual([3]);
		expect(result[3].state).toBe('planned');
	});
});
