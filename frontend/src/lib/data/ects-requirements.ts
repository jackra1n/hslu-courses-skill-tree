import { getCatalog } from './catalog-loader';
import type { EctsRequirements } from './catalog-types';

export type { EctsRequirements } from './catalog-types';

export function getEctsRequirements(program: string): EctsRequirements | null {
	const byProgram = getCatalog().ectsRequirements;
	return byProgram[program.toUpperCase()] ?? null;
}
