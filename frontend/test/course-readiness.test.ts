import { describe, expect, test } from 'bun:test';
import type {
	CatalogCourse,
	PrerequisiteRule,
} from '../src/lib/data/catalog-types';
import { nextCourseIds } from '../src/lib/data/course-readiness';
import type { PlanNode, StudyPlan } from '../src/lib/data/study-plan';

function course(
	id: string,
	prerequisites: PrerequisiteRule[] = [],
	assessmentLevelPassed = false,
): CatalogCourse {
	return {
		id,
		label: id,
		ects: 3,
		prerequisites,
		assessmentLevelPassed,
		assessmentModes: [],
		typeByPlanSeason: {},
	};
}

function node(id: string, courseId: string, ects = 3): PlanNode {
	return {
		id,
		courseId,
		kind: 'fixed',
		slotType: 'fixed',
		semester: 1,
		ects,
		label: courseId,
	};
}

function plan(nodes: PlanNode[]): StudyPlan {
	return {
		templateId: 'test',
		planCode: 'HS26',
		rows: [],
		nodes: Object.fromEntries(nodes.map((entry) => [entry.id, entry])),
	};
}

const attendedRule: PrerequisiteRule = {
	modules: ['PRE'],
	mustBePassed: false,
	moduleLinkType: 'und',
};
const completedRule: PrerequisiteRule = {
	modules: ['PRE'],
	mustBePassed: true,
	moduleLinkType: 'und',
};

describe('nextCourseIds', () => {
	test('includes free and satisfied courses while excluding unmet and started courses', () => {
		const studyPlan = plan([
			node('pre-slot', 'PRE'),
			node('attended-slot', 'ATTENDED'),
			node('completed-slot', 'COMPLETED'),
		]);
		const statuses = new Map<string, 'attended' | 'completed'>([
			['pre-slot', 'attended'],
			['attended-slot', 'attended'],
			['completed-slot', 'completed'],
		]);
		const courses = [
			course('FREE'),
			course('READY', [attendedRule]),
			course('NEEDS_PASS', [completedRule]),
			course('ATTENDED'),
			course('COMPLETED'),
			course('ASSESSMENT', [], true),
		];

		expect([...nextCourseIds(courses, studyPlan, statuses, false)]).toEqual([
			'FREE',
			'READY',
		]);
	});

	test('accepts passed prerequisites and assessment-stage requirements', () => {
		const completedNodes = Array.from({ length: 9 }, (_, index) =>
			node(`completed-${index}`, `DONE-${index}`, 6),
		);
		const studyPlan = plan([node('pre-slot', 'PRE'), ...completedNodes]);
		const statuses = new Map<string, 'attended' | 'completed'>([
			['pre-slot', 'completed'],
			...completedNodes.map((entry) => [entry.id, 'completed'] as const),
		]);
		const courses = [
			course('NEEDS_PASS', [completedRule]),
			course('ASSESSMENT', [], true),
		];

		expect([...nextCourseIds(courses, studyPlan, statuses, true)]).toEqual([
			'NEEDS_PASS',
			'ASSESSMENT',
		]);
	});
});
