export type Season = 'HS' | 'FS';

export const SEASON_LABELS: Record<Season, string> = {
  HS: 'Herbst (HS)',
  FS: 'Frühling (FS)'
};

export function otherSeason(season: Season): Season {
  return season === 'HS' ? 'FS' : 'HS';
}

// Semester 1 runs in the start season; every later semester alternates.
export function seasonOfSemester(semester: number, startSeason: Season): Season {
  return (semester - 1) % 2 === 0 ? startSeason : otherSeason(startSeason);
}

export type Term = { season: Season; year: number };

// Orders terms chronologically: spring sorts before autumn within a year.
export function termOrdinal(year: number, season: Season): number {
  return year * 2 + (season === 'HS' ? 1 : 0);
}

export function formatTerm(term: Term): string {
  return `${term.season} ${term.year}`;
}

// The calendar term a 1-indexed plan semester falls in, given the start term.
export function termOfSemester(semester: number, start: Term): Term {
  const ordinal = termOrdinal(start.year, start.season) + (semester - 1);
  return { year: Math.floor(ordinal / 2), season: ordinal % 2 === 1 ? 'HS' : 'FS' };
}

// Plan codes are introduced each autumn, e.g. "HS25" -> autumn 2025.
export function planIntroYear(plan: string): number | null {
  const match = /^HS(\d{2})$/.exec(plan);
  return match ? 2000 + Number(match[1]) : null;
}

// The plan in effect for a start term: the latest one introduced on or before
// it, falling back to the earliest available plan.
export function resolvePlan(availablePlans: string[], start: Term): string | null {
  const startOrdinal = termOrdinal(start.year, start.season);
  const dated = availablePlans
    .map((plan) => ({ plan, year: planIntroYear(plan) }))
    .filter((entry): entry is { plan: string; year: number } => entry.year !== null)
    .sort((a, b) => a.year - b.year);
  if (dated.length === 0) return null;

  const eligible = dated.filter((entry) => termOrdinal(entry.year, 'HS') <= startOrdinal);
  return (eligible.at(-1) ?? dated[0]).plan;
}
