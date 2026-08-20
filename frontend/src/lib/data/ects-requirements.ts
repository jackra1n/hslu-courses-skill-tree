import { loadBundledCatalog } from './catalog-loader';
import type { EctsRequirements } from './catalog-types';

export type { EctsRequirements } from './catalog-types';

const byProgram = new Map<string, EctsRequirements>(
	Object.entries(loadBundledCatalog().ectsRequirements).map(
		([program, requirements]) => [program.toUpperCase(), requirements],
	),
);

export function getEctsRequirements(program: string): EctsRequirements | null {
	return byProgram.get(program.toUpperCase()) ?? null;
}
