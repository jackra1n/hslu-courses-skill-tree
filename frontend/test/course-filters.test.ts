import { describe, expect, test } from 'bun:test';
import type { CatalogCourse } from '../src/lib/data/catalog-types';
import {
	EMPTY_FILTERS,
	courseModuleType,
	filterCourses,
	isFiltering,
} from '../src/lib/data/course-filters';

function course(overrides: Partial<CatalogCourse> & { id: string }): CatalogCourse {
	return {
		label: overrides.id,
		ects: 3,
		prerequisites: [],
		typeByPlanSeason: {},
		...overrides,
	};
}

const COURSES: CatalogCourse[] = [
	course({
		id: 'AINF',
		label: 'Analysis',
		labelEn: 'Calculus',
		ects: 3,
		seasons: ['HS'],
		typeByPlanSeason: { default: 'Kernmodul' },
	}),
	course({
		id: 'SEC',
		label: 'IT-Sicherheit',
		labelEn: 'IT Security',
		ects: 6,
		seasons: ['FS'],
		typeByPlanSeason: { default: 'Major-/Minormodul' },
	}),
	course({
		id: 'PROJ',
		label: 'Projektarbeit',
		ects: 9,
		seasons: ['HS', 'FS'],
		typeByPlanSeason: { HS: 'Projektmodul', FS: 'Projektmodul' },
	}),
	course({
		id: 'MISC',
		label: 'Freies Modul',
		ects: 2,
		seasons: [],
		typeByPlanSeason: {},
	}),
];

function ids(filtered: CatalogCourse[]): string[] {
	return filtered.map((c) => c.id);
}

describe('courseModuleType', () => {
	test('prefers the plan default over season types', () => {
		expect(
			courseModuleType(
				course({
					id: 'X',
					typeByPlanSeason: { default: 'Kernmodul', HS: 'Projektmodul' },
				}),
			),
		).toBe('Kernmodul');
	});

	test('falls back to a season type and then undefined', () => {
		expect(
			courseModuleType(
				course({ id: 'X', typeByPlanSeason: { FS: 'Zusatzmodul' } }),
			),
		).toBe('Zusatzmodul');
		expect(courseModuleType(course({ id: 'X' }))).toBeUndefined();
	});
});

describe('filterCourses', () => {
	test('empty filters return everything in order', () => {
		expect(ids(filterCourses(COURSES, EMPTY_FILTERS))).toEqual([
			'AINF',
			'SEC',
			'PROJ',
			'MISC',
		]);
	});

	test('query matches id and both languages case-insensitively', () => {
		expect(ids(filterCourses(COURSES, { ...EMPTY_FILTERS, query: 'ainf' }))).toEqual(
			['AINF'],
		);
		expect(ids(filterCourses(COURSES, { ...EMPTY_FILTERS, query: 'calculus' }))).toEqual(
			['AINF'],
		);
		expect(
			ids(filterCourses(COURSES, { ...EMPTY_FILTERS, query: 'sicherheit' })),
		).toEqual(['SEC']);
		expect(
			ids(filterCourses(COURSES, { ...EMPTY_FILTERS, query: '  proj  ' })),
		).toEqual(['PROJ']);
	});

	test('season filter keeps both-season and unknown-season courses', () => {
		expect(ids(filterCourses(COURSES, { ...EMPTY_FILTERS, season: 'HS' }))).toEqual(
			['AINF', 'PROJ', 'MISC'],
		);
		expect(ids(filterCourses(COURSES, { ...EMPTY_FILTERS, season: 'FS' }))).toEqual(
			['SEC', 'PROJ', 'MISC'],
		);
	});

	test('module type filter uses the resolved plan-agnostic type', () => {
		expect(
			ids(filterCourses(COURSES, { ...EMPTY_FILTERS, moduleType: 'Projektmodul' })),
		).toEqual(['PROJ']);
		expect(
			ids(filterCourses(COURSES, { ...EMPTY_FILTERS, moduleType: 'Zusatzmodul' })),
		).toEqual([]);
	});

	test('ects buckets partition small, standard and large modules', () => {
		expect(ids(filterCourses(COURSES, { ...EMPTY_FILTERS, ects: 'small' }))).toEqual(
			['AINF', 'MISC'],
		);
		expect(ids(filterCourses(COURSES, { ...EMPTY_FILTERS, ects: 'medium' }))).toEqual(
			['SEC'],
		);
		expect(ids(filterCourses(COURSES, { ...EMPTY_FILTERS, ects: 'large' }))).toEqual(
			['PROJ'],
		);
	});

	test('dimensions combine with AND', () => {
		expect(
			ids(
				filterCourses(COURSES, {
					...EMPTY_FILTERS,
					query: 'projekt',
					season: 'FS',
					moduleType: 'Projektmodul',
					ects: 'large',
				}),
			),
		).toEqual(['PROJ']);
		expect(
			ids(
				filterCourses(COURSES, {
					...EMPTY_FILTERS,
					season: 'HS',
					moduleType: 'Major-/Minormodul',
				}),
			),
		).toEqual([]);
	});
});

describe('isFiltering', () => {
	test('empty and whitespace-only queries are not filtering', () => {
		expect(isFiltering(EMPTY_FILTERS)).toBe(false);
		expect(isFiltering({ ...EMPTY_FILTERS, query: '   ' })).toBe(false);
	});

	test('any active dimension counts as filtering', () => {
		expect(isFiltering({ ...EMPTY_FILTERS, query: 'x' })).toBe(true);
		expect(isFiltering({ ...EMPTY_FILTERS, season: 'HS' })).toBe(true);
		expect(isFiltering({ ...EMPTY_FILTERS, moduleType: 'Kernmodul' })).toBe(true);
		expect(isFiltering({ ...EMPTY_FILTERS, ects: 'large' })).toBe(true);
	});
});
