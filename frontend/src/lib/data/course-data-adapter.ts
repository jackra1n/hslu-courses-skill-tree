import type { Course, ModuleType, PrerequisiteLink, PrerequisiteRule } from './courses';

type RawPrerequisiteLink = 'und' | 'oder' | 'UND' | 'ODER' | 'AND' | 'OR';

type RawModuleOffer = {
  Department: string;
  DegreeProgramme: string;
  ModuleType: string;
  CourseOffering?: string;
  OfferedToClasses?: string[];
};

type RawModulePrerequisite = {
  Modules: string[];
  MustBePassed: boolean;
  ModuleLinkType: RawPrerequisiteLink;
  PrerequisiteLinkType?: RawPrerequisiteLink;
};

type RawModule = {
  Name: string;
  NameEnglish?: string | null;
  ShortName: string;
  EventoIdentifier?: string;
  Description?: string | null;
  DescriptionEnglish?: string | null;
  Term?: string;
  Ects: number;
  ExecutionType?: string;
  Language?: string;
  CourseOffering?: string;
  ModuleOffers?: RawModuleOffer[];
  ModuleCoordinator?: string;
  ResponsibleDegreeProgramme?: string;
  ResponsibleDegreeProgrammeCoordinator?: string;
  Prerequisites?: RawModulePrerequisite[] | null;
  PrerequisiteNote?: string | null;
  AssessmentLevelPassed?: boolean;
  ModeOfAssessments?: string[];
  Workload?: Record<string, number>;
};

type RawModuleFile = {
  data: RawModule[];
};

const moduleFileGlob = import.meta.glob('./hslu_data/modules/*_modules.json', {
  eager: true,
  import: 'default'
}) as Record<string, RawModuleFile>;

type SemesterCode = {
  raw: string;
  season: 'F' | 'H';
  year: number;
};

function parseSemesterFromPath(path: string): SemesterCode | null {
  const match = /\/([FH])(\d{2})_modules\.json$/.exec(path);
  if (!match) return null;
  const [, season, yearSuffix] = match;
  const year = Number(`20${yearSuffix}`);
  if (Number.isNaN(year)) return null;
  return {
    raw: `${season}${yearSuffix}`,
    season: season as 'F' | 'H',
    year
  };
}

function compareSemester(a: SemesterCode, b: SemesterCode): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  // frühling comes before herbst within the same year
  if (a.season === b.season) return 0;
  return a.season === 'F' ? -1 : 1;
}

const orderedModuleEntries = Object.entries(moduleFileGlob)
  .map(([path, file]) => {
    const semester = parseSemesterFromPath(path);
    return semester ? { semester, file } : null;
  })
  .filter((entry): entry is { semester: SemesterCode; file: RawModuleFile } => entry !== null)
  .sort((a, b) => compareSemester(a.semester, b.semester));

const moduleIndex: Map<string, RawModule> = new Map();

for (const entry of orderedModuleEntries) {
  entry.file.data.forEach((module) => {
    if (!module.ShortName) return;
    moduleIndex.set(module.ShortName, module);
  });
}

function mapModuleType(rawType: string | undefined): ModuleType | undefined {
  switch (rawType) {
    case 'Kernmodul':
    case 'Projektmodul':
    case 'Erweiterungsmodul':
    case 'Major-/Minormodul':
    case 'Zusatzmodul':
      return rawType;
    default:
      return undefined;
  }
}

function selectModuleType(module: RawModule, plan: string): ModuleType | undefined {
  const offers = module.ModuleOffers ?? [];
  if (offers.length === 0) return undefined;

  const preferredSeason: string = plan.startsWith('HS')
    ? 'Herbst'
    : plan.startsWith('FS')
    ? 'Frühling'
    : 'Frühling/Herbst';

  const offersForInformatik = offers.filter(
    (offer) => offer.DegreeProgramme === 'Informatik'
  );
  const candidateOffers = offersForInformatik.length > 0 ? offersForInformatik : offers;

  const bySeasonPreference = candidateOffers.find(
    (offer) => offer.CourseOffering === preferredSeason
  );
  if (bySeasonPreference) return mapModuleType(bySeasonPreference.ModuleType);

  const flexibleOffer = candidateOffers.find(
    (offer) => offer.CourseOffering === 'Frühling/Herbst'
  );
  if (flexibleOffer) return mapModuleType(flexibleOffer.ModuleType);

  return mapModuleType(candidateOffers[0]?.ModuleType);
}

function mapPrerequisites(prereqs: RawModule['Prerequisites']): PrerequisiteRule[] {
  if (!prereqs) return [];

  const normaliseLink = (value?: RawPrerequisiteLink): PrerequisiteLink | undefined => {
    if (!value) return undefined;
    switch (value.toLowerCase()) {
      case 'und':
      case 'and':
        return 'und';
      case 'oder':
      case 'or':
        return 'oder';
      default:
        return undefined;
    }
  };

  return prereqs.map((rule) => ({
    modules: rule.Modules,
    mustBePassed: rule.MustBePassed,
    moduleLinkType: normaliseLink(rule.ModuleLinkType) ?? 'und',
    prerequisiteLinkType: normaliseLink(rule.PrerequisiteLinkType)
  }));
}

const courseCache = new Map<string, Course[]>();

function toCourse(module: RawModule, plan: string): Course {
  return {
    id: module.ShortName,
    label: module.NameEnglish?.trim() || module.Name.trim(),
    ects: module.Ects,
    prerequisites: mapPrerequisites(module.Prerequisites ?? []),
    prerequisiteNote: module.PrerequisiteNote || undefined,
    assessmentLevelPassed: module.AssessmentLevelPassed ?? undefined,
    type: selectModuleType(module, plan)
  };
}

export function loadCourseData(plan: string = 'HS25'): Course[] {
  if (courseCache.has(plan)) {
    return courseCache.get(plan)!;
  }

  const courses = Array.from(moduleIndex.values()).map((module) =>
    toCourse(module, plan)
  );

  courseCache.set(plan, courses);
  return courses;
}
