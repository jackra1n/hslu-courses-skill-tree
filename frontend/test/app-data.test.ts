import { describe, expect, test } from 'bun:test';
import { type AppData, parseAppData } from '../src/lib/data/app-data';

function snapshot(): AppData {
	return {
		version: 1,
		currentTemplateId: 'inf-fulltime-HS25',
		start: { season: 'HS', year: 2025 },
		studyPlans: {
			'inf-fulltime-HS25': {
				templateId: 'inf-fulltime-HS25',
				planCode: 'HS25',
				rows: [{ semester: 1, nodeOrder: ['ana-g', 'custom-1'] }],
				nodes: {
					'ana-g': {
						id: 'ana-g',
						kind: 'fixed',
						slotType: 'fixed',
						semester: 1,
						baseCourseId: 'ANA-G',
						courseId: 'ANA-G',
						ects: 3,
						label: 'Analysis',
					},
					'custom-1': {
						id: 'custom-1',
						kind: 'custom',
						slotType: 'custom',
						semester: 1,
						courseId: null,
						ects: 0,
						label: 'Custom',
					},
				},
			},
		},
		slotStatus: { 'ana-g': 'completed' },
		preferences: { showShortNamesOnly: false, showCourseTypeBadges: true },
	};
}

const PLAN = ['studyPlans', 'inf-fulltime-HS25'];
const NODE = [...PLAN, 'nodes', 'ana-g'];

function edited(path: string[], ...value: [unknown?]): unknown {
	const data: Record<string, unknown> = structuredClone(snapshot());
	const parent = path
		.slice(0, -1)
		.reduce((record, key) => record[key] as Record<string, unknown>, data);
	const key = path.at(-1) as string;
	if (value.length) parent[key] = value[0];
	else delete parent[key];
	return data;
}

describe('parseAppData', () => {
	test('accepts a valid snapshot', () => {
		expect(parseAppData(snapshot())).toEqual(snapshot());
	});

	test('drops unknown top-level and preference fields', () => {
		const data = { ...snapshot(), extra: true };
		data.preferences = { ...data.preferences, theme: 'dark' } as never;
		expect(parseAppData(data)).toEqual(snapshot());
	});

	test('drops invalid slot statuses without rejecting the snapshot', () => {
		const data = edited(['slotStatus'], {
			'ana-g': 'completed',
			'custom-1': 'failed',
			other: null,
		});
		expect(parseAppData(data)).toEqual(snapshot());
	});

	test('keeps statuses for slots named like object prototype keys', () => {
		const json = JSON.stringify(snapshot()).replaceAll('ana-g', '__proto__');
		const parsed = parseAppData(JSON.parse(json));
		expect(parsed).not.toBeNull();
		expect(Object.hasOwn(parsed?.slotStatus ?? {}, '__proto__')).toBe(true);
		expect(
			Object.getOwnPropertyDescriptor(parsed?.slotStatus, '__proto__')?.value,
		).toBe('completed');
	});

	test.each([
		[
			'the same row',
			[{ semester: 1, nodeOrder: ['ana-g', 'custom-1', 'ana-g'] }],
		],
		[
			'another row',
			[
				{ semester: 1, nodeOrder: ['ana-g', 'custom-1'] },
				{ semester: 2, nodeOrder: ['ana-g'] },
			],
		],
	])(
		'repairs a node repeated in %s by keeping its first entry',
		(_name, rows) => {
			const parsed = parseAppData(edited([...PLAN, 'rows'], rows));
			expect(
				parsed?.studyPlans['inf-fulltime-HS25']?.rows.flatMap(
					(row) => row.nodeOrder,
				),
			).toEqual(['ana-g', 'custom-1']);
		},
	);

	test('keeps plans for templates named like object prototype keys', () => {
		const json = JSON.stringify(snapshot()).replaceAll(
			'inf-fulltime-HS25',
			'__proto__',
		);
		const parsed = parseAppData(JSON.parse(json));
		expect(Object.hasOwn(parsed?.studyPlans ?? {}, '__proto__')).toBe(true);
	});

	test.each([
		['a non-object', null],
		['an array', []],
		['an unknown version', edited(['version'], 2)],
		['a missing template id', edited(['currentTemplateId'])],
		['an unknown season', edited(['start', 'season'], 'XX')],
		['a fractional year', edited(['start', 'year'], 2025.5)],
		['an array of plans', edited(['studyPlans'], [])],
		['a null plan', edited(PLAN, null)],
		['a plan keyed by another template', edited([...PLAN, 'templateId'], 'x')],
		['non-object nodes', edited([...PLAN, 'nodes'], 'nodes')],
		['non-array rows', edited([...PLAN, 'rows'], {})],
		[
			'a non-string node id',
			edited([...PLAN, 'rows'], [{ semester: 1, nodeOrder: [1] }]),
		],
		[
			'a row naming a missing node',
			edited(
				[...PLAN, 'rows'],
				[{ semester: 1, nodeOrder: ['ana-g', 'custom-1', 'gone'] }],
			),
		],
		[
			'a node missing from every row',
			edited([...PLAN, 'rows'], [{ semester: 1, nodeOrder: ['ana-g'] }]),
		],
		['a node id not matching its key', edited([...NODE, 'id'], 'other')],
		['a node with an unknown kind', edited([...NODE, 'kind'], 'optional')],
		['a node with non-numeric ects', edited([...NODE, 'ects'], '3')],
		['non-object slot statuses', edited(['slotStatus'], [])],
		['a missing preference', edited(['preferences', 'showCourseTypeBadges'])],
		[
			'a non-boolean preference',
			edited(['preferences', 'showShortNamesOnly'], 'yes'),
		],
	])('rejects %s', (_name, value) => {
		expect(parseAppData(value)).toBeNull();
	});
});
