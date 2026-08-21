import { getCatalog } from './catalog-loader';
import type { ProgramInfo } from './catalog-types';
import { getAvailableTemplates } from './courses';

export type { ProgramInfo } from './catalog-types';

let _programs: readonly ProgramInfo[] | null = null;
let _programMap: Record<string, string> | null = null;
let _plansByProgram: Record<string, string[]> | null = null;

function getProgramIndexes(): {
	programs: readonly ProgramInfo[];
	programMap: Record<string, string>;
	plansByProgram: Record<string, string[]>;
} {
	if (_programs && _programMap && _plansByProgram) {
		return { programs: _programs, programMap: _programMap, plansByProgram: _plansByProgram };
	}

	const programs = getCatalog().programmes;
	const programMap: Record<string, string> = {};
	for (const program of programs) {
		programMap[program.shortName] = program.name;
	}

	const planSets: Record<string, Set<string>> = {};
	for (const template of getAvailableTemplates()) {
		const plans = planSets[template.studiengang] ?? new Set<string>();
		plans.add(template.plan);
		planSets[template.studiengang] = plans;
	}

	const plansByProgram: Record<string, string[]> = {};
	for (const program of programs) {
		const plans = planSets[program.shortName];
		plansByProgram[program.shortName] = plans ? Array.from(plans).sort() : [];
	}

	_programs = programs;
	_programMap = programMap;
	_plansByProgram = plansByProgram;
	return { programs, programMap, plansByProgram };
}

export function getPrograms(): readonly ProgramInfo[] {
	return getProgramIndexes().programs;
}

export function getProgramPlans(shortName: string): readonly string[] {
	return getProgramIndexes().plansByProgram[shortName] ?? [];
}

export function getProgramName(shortName: string): string {
	return getProgramIndexes().programMap[shortName] ?? shortName;
}
