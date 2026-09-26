import type { PlanNode, PlanRow, StudyPlan } from './planning/study-plan';
import type { Season } from './season';

export const APP_DATA_VERSION = 1;

export type AppData = {
	version: number;
	currentTemplateId: string;
	start: { season: Season; year: number };
	studyPlans: Record<string, StudyPlan>;
	slotStatus: Record<string, 'attended' | 'completed'>;
	preferences: {
		showShortNamesOnly: boolean;
		showCourseTypeBadges: boolean;
	};
};

type UnknownRecord = Record<string, unknown>;

// Record insertion order is not a change; array order (such as semester rows) is.
export function serializeSnapshot(snapshot: object): string {
	return JSON.stringify(snapshot, (_key, value: unknown) => {
		if (value === null || typeof value !== 'object' || Array.isArray(value)) {
			return value;
		}
		const record = value as UnknownRecord;
		return Object.fromEntries(
			Object.keys(record)
				.sort()
				.map((key) => [key, record[key]]),
		);
	});
}

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSemester(value: unknown): value is number {
	return Number.isInteger(value) && (value as number) >= 1;
}

function isPlanRow(value: unknown): value is PlanRow {
	return (
		isRecord(value) &&
		isSemester(value.semester) &&
		Array.isArray(value.nodeOrder) &&
		value.nodeOrder.every((id) => typeof id === 'string')
	);
}

function isPlanNode(value: unknown, id: string): value is PlanNode {
	return (
		isRecord(value) &&
		value.id === id &&
		(value.kind === 'fixed' ||
			value.kind === 'elective' ||
			value.kind === 'custom') &&
		(value.slotType === 'fixed' ||
			value.slotType === 'elective' ||
			value.slotType === 'major' ||
			value.slotType === 'custom') &&
		isSemester(value.semester) &&
		(value.baseCourseId === undefined ||
			typeof value.baseCourseId === 'string') &&
		(value.courseId === undefined ||
			value.courseId === null ||
			typeof value.courseId === 'string') &&
		typeof value.ects === 'number' &&
		Number.isFinite(value.ects) &&
		typeof value.label === 'string'
	);
}

// Plans saved before elective4-s4 existed list elective3-s4 twice.
function withoutRepeatedRowEntries(plan: StudyPlan): StudyPlan {
	const seen = new Set<string>();
	let repeated = false;
	const rows = plan.rows.map((row) => {
		const nodeOrder = row.nodeOrder.filter((id) => {
			if (seen.has(id)) {
				repeated = true;
				return false;
			}
			seen.add(id);
			return true;
		});
		return nodeOrder.length === row.nodeOrder.length
			? row
			: { ...row, nodeOrder };
	});
	return repeated ? { ...plan, rows } : plan;
}

function hasConsistentRows(plan: StudyPlan): boolean {
	const rowNodeIds = new Set(plan.rows.flatMap((row) => row.nodeOrder));
	const nodeIds = Object.keys(plan.nodes);
	return (
		rowNodeIds.size === nodeIds.length &&
		nodeIds.every((id) => rowNodeIds.has(id))
	);
}

export function parseStudyPlan(value: unknown): StudyPlan | null {
	if (
		!isRecord(value) ||
		typeof value.templateId !== 'string' ||
		typeof value.planCode !== 'string' ||
		!Array.isArray(value.rows) ||
		!value.rows.every(isPlanRow) ||
		!isRecord(value.nodes) ||
		!Object.entries(value.nodes).every(([id, node]) => isPlanNode(node, id))
	)
		return null;
	const plan = withoutRepeatedRowEntries(value as StudyPlan);
	return hasConsistentRows(plan) ? plan : null;
}

function validSlotStatuses(value: UnknownRecord): AppData['slotStatus'] {
	return Object.fromEntries(
		Object.entries(value).filter(
			(entry): entry is [string, 'attended' | 'completed'] =>
				entry[1] === 'attended' || entry[1] === 'completed',
		),
	);
}

export function parseAppData(value: unknown): AppData | null {
	if (!isRecord(value) || value.version !== APP_DATA_VERSION) return null;
	const { currentTemplateId, start, studyPlans, slotStatus, preferences } =
		value;
	if (typeof currentTemplateId !== 'string') return null;
	if (
		!isRecord(start) ||
		(start.season !== 'HS' && start.season !== 'FS') ||
		!Number.isInteger(start.year)
	)
		return null;
	if (!isRecord(studyPlans)) return null;
	const plans = Object.entries(studyPlans).map(
		([templateId, plan]) => [templateId, parseStudyPlan(plan)] as const,
	);
	if (!plans.every(([templateId, plan]) => plan?.templateId === templateId))
		return null;
	if (!isRecord(slotStatus)) return null;
	// Older snapshots included theme; device-local preferences never enter sync.
	if (
		!isRecord(preferences) ||
		typeof preferences.showShortNamesOnly !== 'boolean' ||
		typeof preferences.showCourseTypeBadges !== 'boolean'
	)
		return null;

	return {
		version: APP_DATA_VERSION,
		currentTemplateId,
		start: { season: start.season, year: start.year as number },
		studyPlans: Object.fromEntries(plans) as Record<string, StudyPlan>,
		slotStatus: validSlotStatuses(slotStatus),
		preferences: {
			showShortNamesOnly: preferences.showShortNamesOnly,
			showCourseTypeBadges: preferences.showCourseTypeBadges,
		},
	};
}
