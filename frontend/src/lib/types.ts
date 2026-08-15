// re-export all types from the data module for centralized access
export type {
	Course,
	CurriculumTemplate,
	ExtendedNodeData,
	ModuleType,
	PrerequisiteLink,
	PrerequisiteRule,
	Status,
	TemplateSlot,
} from '$lib/data/courses';

export type NodeHandleCounts = {
	source: number;
	target: number;
};

export type HandleUsage = Record<string, NodeHandleCounts>;
