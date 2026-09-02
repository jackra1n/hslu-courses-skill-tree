import type { Season } from './season';

export type ModuleType =
	| 'Kernmodul'
	| 'Projektmodul'
	| 'Erweiterungsmodul'
	| 'Major-/Minormodul'
	| 'Zusatzmodul';

export type PrerequisiteLink = 'und' | 'oder';

export type PrerequisiteRule = {
	modules: string[];
	mustBePassed: boolean;
	moduleLinkType: PrerequisiteLink;
	prerequisiteLinkType?: PrerequisiteLink;
};

export type Course = {
	id: string;
	label: string;
	labelEn?: string;
	ects: number;
	prerequisites: PrerequisiteRule[];
	prerequisiteNote?: string;
	assessmentLevelPassed?: boolean;
	type?: ModuleType;
	// Seasons the module is offered in; empty/undefined means unknown (treated as any).
	seasons?: Season[];
};

export type TemplateSlot = {
	id: string;
	type: 'fixed' | 'elective' | 'major';
	courseId?: string; // for fixed courses
	semester: number;
};

export type StudyModel = 'fulltime' | 'parttime';

export type CurriculumTemplate = {
	id: string;
	name: string;
	studiengang: string;
	modell: StudyModel;
	plan: string; // e.g., "HS16", "HS25"
	slots: TemplateSlot[];
	programShortName?: string;
	programName?: string;
};

export type ProgramInfo = {
	shortName: string;
	name: string;
};

export type EctsRequirements = {
	total: number;
	perModule: Partial<Record<ModuleType, number>>;
};

// A normalized course: the newest snapshot's content plus the module type for
// each plan season, computed once at build time instead of per request.
export type CatalogCourse = Omit<Course, 'type'> & {
	typeByPlanSeason: Partial<Record<'FS' | 'HS' | 'default', ModuleType>>;
};

export type CatalogData = {
	schemaVersion: 1;
	dataVersion: string;
	programmes: ProgramInfo[];
	templates: CurriculumTemplate[];
	ectsRequirements: Record<string, EctsRequirements>;
	courses: CatalogCourse[];
};
