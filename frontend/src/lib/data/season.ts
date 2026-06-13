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
