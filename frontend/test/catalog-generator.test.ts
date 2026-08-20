import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildCatalog, serializeCatalog } from '../scripts/generate-catalog';

const fixtureRoots: string[] = [];

function writeJson(root: string, path: string, value: unknown): void {
	const target = join(root, path);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, `${JSON.stringify(value, null, '\t')}\n`);
}

function writeRaw(root: string, path: string, value: string): void {
	const target = join(root, path);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, value);
}

function createFixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'catalog-generator-'));
	fixtureRoots.push(root);
	writeJson(root, 'hslu_data/modules/F24_modules.json', {
		data: [
			{
				Name: 'Alpha alt',
				NameEnglish: 'Alpha old',
				ShortName: 'A',
				Ects: 2,
				ModuleOffers: [
					{
						DegreeProgramme: 'Informatik',
						ModuleType: 'Kernmodul',
						CourseOffering: 'Frühling',
					},
				],
			},
			{
				Name: 'Beta',
				NameEnglish: '',
				ShortName: 'B',
				Ects: 3,
				ModuleOffers: [
					{
						DegreeProgramme: 'Other',
						ModuleType: 'Zusatzmodul',
						CourseOffering: 'Frühling',
					},
					{
						DegreeProgramme: 'Informatik',
						ModuleType: 'Projektmodul',
						CourseOffering: 'Frühling/Herbst',
					},
				],
			},
		],
	});
	writeJson(root, 'hslu_data/modules/H24_modules.json', {
		data: [
			{
				Name: 'Alpha neu',
				NameEnglish: 'Alpha new',
				ShortName: 'A',
				Ects: 4,
				Prerequisites: [
					{
						Modules: ['B', 'C'],
						MustBePassed: true,
						ModuleLinkType: 'AND',
						PrerequisiteLinkType: 'OR',
					},
				],
				PrerequisiteNote: 'Bring experience',
				AssessmentLevelPassed: false,
				ModuleOffers: [
					{
						DegreeProgramme: 'Other',
						ModuleType: 'Zusatzmodul',
						CourseOffering: 'Herbst',
					},
					{
						DegreeProgramme: 'Informatik',
						ModuleType: 'Erweiterungsmodul',
						CourseOffering: 'Herbst',
					},
					{
						DegreeProgramme: 'Informatik',
						ModuleType: 'Kernmodul',
						CourseOffering: 'Frühling',
					},
					{
						DegreeProgramme: 'Informatik',
						ModuleType: 'Major-/Minormodul',
						CourseOffering: 'Frühling/Herbst',
					},
				],
			},
			{
				Name: 'Unsupported',
				ShortName: 'C',
				Ects: 1,
				ModuleOffers: [
					{
						DegreeProgramme: 'Informatik',
						ModuleType: 'Not a module type',
						CourseOffering: 'Herbst',
					},
				],
			},
			{
				Name: 'First offer',
				ShortName: 'D',
				Ects: 1,
				ModuleOffers: [
					{
						ModuleType: 'Zusatzmodul',
						CourseOffering: 'Block',
					},
				],
			},
		],
	});
	writeJson(root, 'hslu_data/study_programmes.json', {
		data: [
			{ ShortName: 'zzz', Name: 'Zeta Programme' },
			{ ShortName: 'inf', Name: 'Informatik' },
		],
	});
	writeJson(root, 'hslu_data/ects/INF_ects.json', {
		data: {
			TotalECTS: '180',
			ectsPerModule: { Kernmodul: '84', Projektmodul: '18' },
		},
	});
	writeJson(root, 'hslu_data/latest_semester.json', { data: 'H24' });
	writeJson(root, 'templates/zzz/parttime/hs24.json', {
		name: 'Zeta part-time',
		slots: [{ id: 'same', type: 'fixed', semester: 1, courseId: 'UNKNOWN' }],
	});
	writeJson(root, 'templates/inf/fulltime/hs24.json', {
		id: 'supplied-template-id',
		name: 'INF full-time',
		programName: 'Wrong fallback',
		slots: [
			{ id: 'duplicate', type: 'fixed', semester: 1, courseId: 'MAJOR' },
			{ id: 'duplicate', type: 'elective', semester: 2 },
		],
	});
	return root;
}

function expectBuildError(root: string, message: string): void {
	expect(() => buildCatalog(root)).toThrow(message);
}

afterEach(() => {
	for (const root of fixtureRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe('catalog normalization', () => {
	test('preserves ordering while applying newest fields and unioning seasons', () => {
		const catalog = buildCatalog(createFixture());
		expect(catalog.courses.map((course) => course.id)).toEqual([
			'A',
			'B',
			'C',
			'D',
		]);
		expect(catalog.courses[0]).toEqual({
			id: 'A',
			label: 'Alpha new',
			ects: 4,
			prerequisites: [
				{
					modules: ['B', 'C'],
					mustBePassed: true,
					moduleLinkType: 'und',
					prerequisiteLinkType: 'oder',
				},
			],
			prerequisiteNote: 'Bring experience',
			assessmentLevelPassed: false,
			typeByPlanSeason: {
				HS: 'Erweiterungsmodul',
				FS: 'Kernmodul',
				default: 'Major-/Minormodul',
			},
			seasons: ['FS', 'HS'],
		});
		expect(catalog.courses[1]?.label).toBe('Beta');
		expect(catalog.courses[1]?.typeByPlanSeason).toEqual({
			HS: 'Projektmodul',
			FS: 'Projektmodul',
			default: 'Projektmodul',
		});
		expect(catalog.courses[2]?.typeByPlanSeason).toEqual({});
		expect(catalog.courses[3]?.typeByPlanSeason).toEqual({
			HS: 'Zusatzmodul',
			FS: 'Zusatzmodul',
			default: 'Zusatzmodul',
		});
	});

	test('normalizes and sorts programmes, templates, and ECTS', () => {
		const catalog = buildCatalog(createFixture());
		expect(catalog.schemaVersion).toBe(1);
		expect(catalog.dataVersion).toBe('H24');
		expect(catalog.programmes).toEqual([
			{ shortName: 'INF', name: 'Informatik' },
			{ shortName: 'ZZZ', name: 'Zeta Programme' },
		]);
		expect(catalog.templates.map((template) => template.id)).toEqual([
			'supplied-template-id',
			'zzz-parttime-hs24',
		]);
		expect(catalog.templates[0]).toMatchObject({
			studiengang: 'INF',
			modell: 'fulltime',
			plan: 'HS24',
			programShortName: 'INF',
			programName: 'Informatik',
		});
		expect(catalog.templates[0]?.slots).toHaveLength(2);
		expect(catalog.templates[1]?.slots[0]?.courseId).toBe('UNKNOWN');
		expect(catalog.ectsRequirements.INF).toEqual({
			total: 180,
			perModule: { Kernmodul: 84, Projektmodul: 18 },
		});
	});

	test('serializes deterministically', () => {
		const root = createFixture();
		const first = serializeCatalog(buildCatalog(root));
		const second = serializeCatalog(buildCatalog(root));
		expect(first).toBe(second);
		expect(first.endsWith('\n')).toBe(true);
	});
});

describe('catalog validation', () => {
	test('rejects invalid JSON and envelopes with their source paths', () => {
		let root = createFixture();
		writeRaw(root, 'hslu_data/study_programmes.json', '{bad');
		expectBuildError(root, 'study_programmes.json: invalid JSON');

		root = createFixture();
		writeJson(root, 'hslu_data/study_programmes.json', []);
		expectBuildError(root, 'study_programmes.json: invalid envelope');
	});

	test('rejects duplicate IDs at each unique scope', () => {
		let root = createFixture();
		const duplicateModule = {
			Name: 'Duplicate',
			ShortName: 'A',
			Ects: 3,
		};
		writeJson(root, 'hslu_data/modules/F24_modules.json', {
			data: [duplicateModule, duplicateModule],
		});
		expectBuildError(root, 'duplicate module id "A"');

		root = createFixture();
		writeJson(root, 'hslu_data/study_programmes.json', {
			data: [
				{ ShortName: 'inf', Name: 'One' },
				{ ShortName: 'INF', Name: 'Two' },
			],
		});
		expectBuildError(root, 'duplicate programme id "INF"');

		root = createFixture();
		writeJson(root, 'templates/zzz/parttime/hs24.json', {
			id: 'supplied-template-id',
			name: 'Duplicate',
			slots: [],
		});
		expectBuildError(root, 'duplicate template id "supplied-template-id"');
	});

	test.each([
		['ShortName', { Name: 'Module', Ects: 3 }, 'missing ShortName id'],
		['Name', { ShortName: 'MOD', Ects: 3 }, 'missing Name'],
		['Ects', { ShortName: 'MOD', Name: 'Module', Ects: '3' }, 'finite number'],
	])('rejects an invalid module %s', (_field, module, message) => {
		const root = createFixture();
		writeJson(root, 'hslu_data/modules/F24_modules.json', { data: [module] });
		expectBuildError(root, message);
	});

	test('rejects invalid snapshot and template paths', () => {
		let root = createFixture();
		writeJson(root, 'hslu_data/modules/snapshot.json', { data: [] });
		expectBuildError(root, 'invalid snapshot filename');

		root = createFixture();
		writeJson(root, 'templates/inf/hs24.json', { name: 'Bad path', slots: [] });
		expectBuildError(root, 'invalid template filename');
	});

	test.each([
		[
			'model',
			'templates/inf/evening/hs24.json',
			{ name: 'Bad', slots: [] },
			'invalid study model',
		],
		[
			'slot type',
			'templates/inf/fulltime/hs25.json',
			{ name: 'Bad', slots: [{ id: 'x', type: 'other', semester: 1 }] },
			'invalid slot type',
		],
		[
			'semester',
			'templates/inf/fulltime/hs25.json',
			{ name: 'Bad', slots: [{ id: 'x', type: 'fixed', semester: 1.5 }] },
			'slot semester must be an integer',
		],
	])('rejects an invalid template %s', (_case, path, template, message) => {
		const root = createFixture();
		writeJson(root, path, template);
		expectBuildError(root, message);
	});

	test.each([
		['category', { NotReal: '3' }, 'invalid ECTS category'],
		['value', { Kernmodul: 'nope' }, 'invalid ECTS value'],
	])('rejects an invalid ECTS %s', (_case, ectsPerModule, message) => {
		const root = createFixture();
		writeJson(root, 'hslu_data/ects/INF_ects.json', {
			data: { TotalECTS: '180', ectsPerModule },
		});
		expectBuildError(root, message);
	});

	test('rejects a latest semester without a snapshot', () => {
		const root = createFixture();
		writeJson(root, 'hslu_data/latest_semester.json', { data: 'H25' });
		expectBuildError(root, 'latest semester "H25" has no matching snapshot');
	});
});

test('production catalog satisfies its data and size contract', () => {
	const dataRoot = join(import.meta.dir, '..', 'data');
	const catalog = buildCatalog(dataRoot);
	const byId = new Map(catalog.courses.map((course) => [course.id, course]));

	expect(catalog.schemaVersion).toBe(1);
	expect(catalog.dataVersion).toBe('H25');
	expect(catalog.courses).toHaveLength(591);
	expect(catalog.templates).toHaveLength(10);
	expect(catalog.programmes).toHaveLength(6);
	expect(catalog.ectsRequirements.INF?.total).toBe(180);
	expect(byId.get('CISO_ISSUES')?.label).toBe(
		'CISO Issues - applied experience',
	);
	expect(byId.get('SOC')?.seasons).toEqual(['FS', 'HS']);
	expect(Buffer.byteLength(serializeCatalog(catalog))).toBeLessThan(250_000);
});
