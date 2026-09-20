import { getCatalog } from './catalog-loader';
import type { ProgramInfo } from './catalog-types';
import { getAvailableTemplates } from './courses';

export type { ProgramInfo } from './catalog-types';

let _programs: readonly ProgramInfo[] | null = null;
let _plansByProgram: Record<string, string[]> | null = null;

function getProgramIndexes(): {
	programs: readonly ProgramInfo[];
	plansByProgram: Record<string, string[]>;
} {
	if (_programs && _plansByProgram) {
		return {
			programs: _programs,
			plansByProgram: _plansByProgram,
		};
	}

	const programs = getCatalog().programmes;
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
	_plansByProgram = plansByProgram;
	return { programs, plansByProgram };
}

export function getPrograms(): readonly ProgramInfo[] {
	return getProgramIndexes().programs;
}

export function getProgramPlans(shortName: string): readonly string[] {
	return getProgramIndexes().plansByProgram[shortName] ?? [];
}
