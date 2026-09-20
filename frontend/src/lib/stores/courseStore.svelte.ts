import {
	type CurriculumTemplate,
	getAvailablePlans,
	getDefaultTemplate,
	getTemplateById,
	getTemplatesByProgram,
	setCoursePlan,
} from '$lib/data/courses';
import { canSelectCourse, isPlanCustomized } from '$lib/data/plan-rules';
import {
	currentStartTerm,
	formatTerm,
	planIntroYear,
	resolvePlan,
	type Season,
	seasonOfSemester,
	termOfSemester,
} from '$lib/data/season';
import {
	calculateAttendedCredits,
	calculateCompletedCredits,
	calculatePlanTotalCredits,
	createStudyPlan,
	deriveSelections,
	normalizePlan,
	type PlanNode,
	type StudyPlan,
	updateNodeCourse,
} from '$lib/data/study-plan';
import { toGraph } from '$lib/graph/build';
import { orderEdgeHandles } from '$lib/graph/edge-order';
import {
	addAddNodeButtons,
	computeDividerLength,
	layoutNodes,
	MAX_SEMESTERS,
} from '$lib/graph/plan-layout';
import * as m from '$lib/paraglide/messages';
import { DragController } from './dragController.svelte';
import {
	loadLegacySelections,
	loadPlan,
	planPrefs,
	savePlan,
} from './planStorage';
import { progressStore, slotStatusMap } from './progressStore.svelte';

const INITIAL_TERM = currentStartTerm();

type FlowNodePosition = { x: number; y: number };
type SemesterIndicator = {
	semester: number;
	isPreview: boolean;
	length: number;
};

function generateNodeId(): string {
	return `custom-${crypto.randomUUID()}`;
}

function requireDefaultTemplate(): CurriculumTemplate {
	const template = getDefaultTemplate();
	if (!template) {
		throw new Error(
			'Catalog does not contain the default Informatik curriculum.',
		);
	}
	return template;
}

class CourseStore {
	private template = $state.raw(requireDefaultTemplate());
	private plan = $state.raw<StudyPlan>(createStudyPlan(this.template, {}));

	get currentTemplate(): CurriculumTemplate {
		return this.template;
	}

	get studyPlan(): StudyPlan {
		return this.plan;
	}
	showShortNamesOnly = $state(false);
	startSeason = $state<Season>(INITIAL_TERM.season);
	startYear = $state<number>(INITIAL_TERM.year);

	private graph = $derived.by(() =>
		toGraph(this.studyPlan, this.showShortNamesOnly),
	);
	private positionedNodes = $derived.by(() =>
		layoutNodes(this.graph.nodes, this.studyPlan.rows),
	);
	private layoutedNodes = $derived.by(() =>
		addAddNodeButtons(this.positionedNodes, this.studyPlan.rows),
	);
	private drag = new DragController({
		layoutedNodes: () => this.layoutedNodes,
		plan: () => this.studyPlan,
		commitRows: (rows) => this.setStudyPlan({ ...this.studyPlan, rows }),
	});

	userSelections = $derived(deriveSelections(this.studyPlan));
	totalCredits = $derived(calculatePlanTotalCredits(this.studyPlan));
	attendedCredits = $derived.by(() =>
		calculateAttendedCredits(this.studyPlan, slotStatusMap()),
	);
	completedCredits = $derived.by(() =>
		calculateCompletedCredits(this.studyPlan, slotStatusMap()),
	);
	nodes = $derived.by(() => this.drag.activeNodes);
	edges = $derived.by(() =>
		orderEdgeHandles(this.graph.edges, this.positionedNodes),
	);

	semesterDividerData: SemesterIndicator[] = $derived.by(() => {
		const rows = (this.drag.previewRows ?? this.studyPlan.rows).slice(
			0,
			MAX_SEMESTERS,
		);
		if (!rows.length) return [];

		const dividerLength = computeDividerLength(rows, this.drag.activeNodes);
		const actualCount = Math.min(this.studyPlan.rows.length, rows.length);

		return rows.map((_, index) => ({
			semester: index + 1,
			isPreview: this.drag.previewRows ? index >= actualCount : false,
			length: dividerLength,
		}));
	});

	canSelectCourseForSlot(slotId: string, courseId: string): boolean {
		return canSelectCourse(this.studyPlan, slotId, courseId);
	}

	private activateTemplate(
		template: CurriculumTemplate,
		resetLayout = false,
		legacySelections: Record<string, string> = {},
	): void {
		setCoursePlan(template.plan);
		const loaded =
			!resetLayout || template.id !== this.currentTemplate.id
				? loadPlan(template, legacySelections)
				: this.studyPlan;
		const next = resetLayout ? createStudyPlan(template, {}) : loaded;
		if (resetLayout) {
			const status = Object.fromEntries(slotStatusMap());
			for (const node of Object.values(loaded.nodes)) {
				if (!node.courseId || next.nodes[node.id]?.courseId !== node.courseId) {
					delete status[node.id];
				}
			}
			progressStore.replaceAll(status);
		}
		this.template = template;
		this.setStudyPlan(next);
		planPrefs.saveTemplate(template.id, template.plan);
	}

	resetProgress(): void {
		const status = Object.fromEntries(slotStatusMap());
		for (const id of Object.keys(this.studyPlan.nodes)) delete status[id];
		progressStore.replaceAll(status);
	}

	resetCurrentPlan(): void {
		this.resetProgress();
		this.activateTemplate(this.currentTemplate, true);
	}

	selectCourseForSlot(slotId: string, courseId: string) {
		if (!this.canSelectCourseForSlot(slotId, courseId)) return;
		this.assignCourse(slotId, courseId);
	}

	clearSlotSelection(slotId: string) {
		this.assignCourse(slotId, null);
	}

	private assignCourse(slotId: string, courseId: string | null): void {
		const node = this.studyPlan.nodes[slotId];
		if (
			!node ||
			node.slotType === 'fixed' ||
			(node.courseId ?? null) === courseId
		)
			return;
		progressStore.clearSlotStatus(slotId);
		this.setStudyPlan(updateNodeCourse(this.studyPlan, slotId, courseId));
	}

	toggleShortNames() {
		this.showShortNamesOnly = !this.showShortNamesOnly;
		this.drag.clear();
		planPrefs.saveShortNames(this.showShortNamesOnly);
	}

	// Switch to `templateId` and record the start term that derived it. When only
	// the start term changes within the same plan, the curriculum is left intact.
	applyStart(
		templateId: string,
		year: number,
		season: Season,
		forceReset = false,
	) {
		const template = getTemplateById(templateId);
		if (!template) return;
		this.startYear = year;
		this.startSeason = season;
		planPrefs.saveStartYear(year);
		planPrefs.saveStartSeason(season);
		if (forceReset || templateId !== this.currentTemplate.id) {
			this.activateTemplate(template, forceReset);
		}
	}

	// Restore state from imported data; study plans must already be in storage.
	restore(
		currentTemplateId: string,
		year: number,
		season: Season,
		showShortNamesOnly: boolean,
	) {
		const template = getTemplateById(currentTemplateId) ?? this.currentTemplate;
		this.startYear = year;
		this.startSeason = season;
		this.showShortNamesOnly = showShortNamesOnly;
		planPrefs.saveStartYear(year);
		planPrefs.saveStartSeason(season);
		planPrefs.saveShortNames(showShortNamesOnly);
		this.activateTemplate(template);
	}

	// The calendar season (HS/FS) a given 1-indexed plan semester falls in.
	seasonOf(semester: number): Season {
		return seasonOfSemester(semester, this.startSeason);
	}

	// The calendar term label (e.g. "FS 2026") for a 1-indexed plan semester.
	semesterLabel(semester: number): string {
		return formatTerm(
			termOfSemester(semester, {
				year: this.startYear,
				season: this.startSeason,
			}),
		);
	}

	init() {
		const savedShortNames = planPrefs.loadShortNames();
		if (savedShortNames !== null) {
			this.showShortNamesOnly = savedShortNames;
		}

		const savedTemplateId = planPrefs.loadTemplateId();
		const savedPlanCode = planPrefs.loadPlanCode();
		const savedTemplate = savedTemplateId
			? getTemplateById(savedTemplateId)
			: savedPlanCode
				? getTemplatesByProgram(
						this.currentTemplate.studiengang,
						this.currentTemplate.modell,
					).find((t) => t.plan === savedPlanCode)
				: undefined;
		let template = savedTemplate ?? this.currentTemplate;

		if (savedTemplate) {
			// returning user: keep their curriculum and start term
			this.startSeason = planPrefs.loadStartSeason() ?? 'HS';
			this.startYear =
				planPrefs.loadStartYear() ??
				planIntroYear(savedTemplate.plan) ??
				this.startYear;
		} else {
			// new user: default to the current calendar term and derive the curriculum
			const term = currentStartTerm();
			this.startSeason = term.season;
			this.startYear = term.year;
			const plan = resolvePlan(
				getAvailablePlans(
					this.currentTemplate.studiengang,
					this.currentTemplate.modell,
				),
				term,
			);
			const resolvedTemplate = plan
				? getTemplatesByProgram(
						this.currentTemplate.studiengang,
						this.currentTemplate.modell,
					).find((t) => t.plan === plan)
				: undefined;
			if (resolvedTemplate) template = resolvedTemplate;
		}

		// Keep the inferred term when activation makes this a returning visit.
		planPrefs.saveStartYear(this.startYear);
		planPrefs.saveStartSeason(this.startSeason);
		this.activateTemplate(template, false, loadLegacySelections());
	}

	handleNodeDragStart() {
		this.drag.start();
	}

	handleNodeDrag(nodeId: string, position: FlowNodePosition) {
		this.drag.drag(nodeId, position);
	}

	handleNodeDragStop(nodeId: string, position: FlowNodePosition) {
		this.drag.stop(nodeId, position);
	}

	addCustomNode(semester: number) {
		if (!Number.isInteger(semester) || semester < 1 || semester > MAX_SEMESTERS)
			return;
		const nodeId = generateNodeId();
		const newNode: PlanNode = {
			id: nodeId,
			kind: 'custom',
			slotType: 'custom',
			semester,
			courseId: null,
			ects: 0,
			label: m.slot_custom(),
		};

		const updatedRows = this.studyPlan.rows.slice();
		while (updatedRows.length < semester) {
			updatedRows.push({ semester: updatedRows.length + 1, nodeOrder: [] });
		}
		const row = updatedRows[semester - 1];
		updatedRows[semester - 1] = {
			...row,
			nodeOrder: [...row.nodeOrder, nodeId],
		};

		this.setStudyPlan({
			...this.studyPlan,
			nodes: { ...this.studyPlan.nodes, [nodeId]: newNode },
			rows: updatedRows,
		});
	}

	removeNode(nodeId: string) {
		const { [nodeId]: removedNode, ...remainingNodes } = this.studyPlan.nodes;
		if (!removedNode) return;
		progressStore.clearSlotStatus(nodeId);

		const updatedRows = this.studyPlan.rows.map((row) =>
			row.semester === removedNode.semester
				? { ...row, nodeOrder: row.nodeOrder.filter((id) => id !== nodeId) }
				: row,
		);
		while (
			updatedRows.length > 1 &&
			updatedRows.at(-1)?.nodeOrder.length === 0
		) {
			updatedRows.pop();
		}

		this.setStudyPlan({
			...this.studyPlan,
			nodes: remainingNodes,
			rows: updatedRows,
		});
	}

	isStudyPlanCustomized(): boolean {
		return isPlanCustomized(this.studyPlan);
	}

	private setStudyPlan(nextPlan: StudyPlan): void {
		const normalized = normalizePlan(nextPlan);
		if (normalized === this.plan) return;
		this.plan = normalized;
		this.drag.clear();
		savePlan(this.studyPlan);
	}
}

let _courseStore: CourseStore | undefined;

export function initializeCourseStore(): CourseStore {
	_courseStore ??= new CourseStore();
	return _courseStore;
}

export function getCourseStore(): CourseStore {
	if (!_courseStore) {
		throw new Error('Course store has not been initialized.');
	}
	return _courseStore;
}
