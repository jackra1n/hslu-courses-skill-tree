import type { ModuleType } from './courses';

type RawEctsFile = {
  data: { TotalECTS: string; ectsPerModule: Record<string, string> };
};

export type EctsRequirements = {
  total: number;
  perModule: Partial<Record<ModuleType, number>>;
};

const files = import.meta.glob('./hslu_data/ects/*_ects.json', {
  eager: true,
  import: 'default'
}) as Record<string, RawEctsFile>;

const byProgram = new Map<string, EctsRequirements>();
for (const [path, file] of Object.entries(files)) {
  const match = /\/([A-Za-z]+)_ects\.json$/.exec(path);
  if (!match) continue;
  const perModule: Partial<Record<ModuleType, number>> = {};
  for (const [category, value] of Object.entries(file.data.ectsPerModule)) {
    perModule[category as ModuleType] = Number(value);
  }
  byProgram.set(match[1].toUpperCase(), { total: Number(file.data.TotalECTS), perModule });
}

export function getEctsRequirements(program: string): EctsRequirements | null {
  return byProgram.get(program.toUpperCase()) ?? null;
}
