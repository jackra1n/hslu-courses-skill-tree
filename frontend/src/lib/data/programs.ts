import type { ProgramInfo } from './catalog-types';
import { AVAILABLE_TEMPLATES } from './courses';
import studyProgrammes from './hslu_data/study_programmes.json';

type StudyProgramme = {
	ShortName: string;
	Name: string;
};

const PROGRAMME_DATA = (studyProgrammes.data ?? []) as StudyProgramme[];

export type { ProgramInfo } from './catalog-types';

export const PROGRAMS: ProgramInfo[] = PROGRAMME_DATA.map((program) => ({
	shortName: program.ShortName.toUpperCase(),
	name: program.Name,
})).sort((a, b) => a.name.localeCompare(b.name));

const PROGRAM_MAP = new Map(
	PROGRAMS.map((program) => [program.shortName, program.name]),
);

const plansByProgram = new Map<string, Set<string>>();
AVAILABLE_TEMPLATES.forEach((template) => {
	const plans = plansByProgram.get(template.studiengang) ?? new Set<string>();
	plans.add(template.plan);
	plansByProgram.set(template.studiengang, plans);
});

export const PROGRAM_PLANS: Record<string, string[]> = PROGRAMS.reduce(
	(acc, program) => {
		const plans = plansByProgram.get(program.shortName);
		acc[program.shortName] = plans ? Array.from(plans).sort() : [];
		return acc;
	},
	{} as Record<string, string[]>,
);

export function getProgramName(shortName: string): string {
	return PROGRAM_MAP.get(shortName) ?? shortName;
}
