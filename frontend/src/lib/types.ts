// re-export all types from the data module for centralized access
export type {
  Course,
  Status,
  ModuleType,
  PrerequisiteRule,
  PrerequisiteLink,
  TemplateSlot,
  CurriculumTemplate,
  ExtendedNodeData,
} from '$lib/data/courses';

export type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

export type NodeHandleCounts = {
  source: number;
  target: number;
};

export type HandleUsage = Record<string, NodeHandleCounts>;
