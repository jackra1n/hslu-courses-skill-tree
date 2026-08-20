import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
	CatalogCourse,
	CatalogData,
	CurriculumTemplate,
	EctsRequirements,
	ModuleType,
	PrerequisiteLink,
	PrerequisiteRule,
	ProgramInfo,
	StudyModel,
} from '../src/lib/data/catalog-types';
import type { Season } from '../src/lib/data/season';

declare global {
	interface ImportMeta {
		main: boolean;
	}
}

const MODULE_TYPE_BY_VALUE: Record<string, ModuleType> = {
	Kernmodul: 'Kernmodul',
	Projektmodul: 'Projektmodul',
	Erweiterungsmodul: 'Erweiterungsmodul',
	'Major-/Minormodul': 'Major-/Minormodul',
	Zusatzmodul: 'Zusatzmodul',
};

const SNAPSHOT_REGEX = /^([FH])(\d{2})_modules\.json$/;
const TEMPLATE_PATH_REGEX = /\.\/templates\/([^/]+)\/([^/]+)\/([^/]+)\.json$/i;
const ECTS_PATH_REGEX = /\/([A-Za-z]+)_ects\.json$/;

type RawPrerequisiteLink = 'und' | 'oder' | 'UND' | 'ODER' | 'AND' | 'OR';

type RawModuleOffer = {
	DegreeProgramme?: string;
	ModuleType?: string;
	CourseOffering?: string;
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
	Ects: number;
	ModuleOffers?: RawModuleOffer[];
	Prerequisites?: RawModulePrerequisite[] | null;
	PrerequisiteNote?: string | null;
	AssessmentLevelPassed?: boolean;
};

type SemesterCode = {
	season: 'F' | 'H';
	year: number;
};

function fail(path: string, message: string): never {
	throw new Error(`${path}: ${message}`);
}

function parseJsonFile(path: string): unknown {
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		fail(path, `invalid JSON: ${detail}`);
	}
	return parsed;
}

function readEnvelope(path: string): { data: unknown } {
	const parsed = parseJsonFile(path);
	if (typeof parsed !== 'object' || parsed === null || !('data' in parsed)) {
		fail(path, 'invalid envelope: expected an object with a "data" field');
	}
	return { data: parsed.data };
}

function listJsonFiles(directory: string): string[] {
	let entries: string[];
	try {
		entries = readdirSync(directory);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		fail(directory, `cannot read directory: ${detail}`);
	}
	return entries
		.filter((entry) => entry.endsWith('.json'))
		.map((entry) => join(directory, entry))
		.sort();
}

function compareSemester(a: SemesterCode, b: SemesterCode): number {
	if (a.year !== b.year) {
		return a.year - b.year;
	}
	// frühling comes before herbst within the same year
	if (a.season === b.season) return 0;
	return a.season === 'F' ? -1 : 1;
}

function parseSemesterFromPath(path: string): SemesterCode | null {
	const match = SNAPSHOT_REGEX.exec(path.split('/').at(-1) ?? '');
	if (!match) return null;
	const [, season, yearSuffix] = match;
	const year = Number(`20${yearSuffix}`);
	if (Number.isNaN(year)) return null;
	return { season: season as 'F' | 'H', year };
}

// Seasons a module is offered in, preferring Informatik offers like
// selectModuleType.
function offeredSeasons(module: RawModule): Season[] {
	const offers = module.ModuleOffers ?? [];
	const informatikOffers = offers.filter(
		(offer) => offer.DegreeProgramme === 'Informatik',
	);
	const candidateOffers =
		informatikOffers.length > 0 ? informatikOffers : offers;

	const seasons: Season[] = [];
	for (const offer of candidateOffers) {
		if (offer.CourseOffering === 'Frühling') seasons.push('FS');
		else if (offer.CourseOffering === 'Herbst') seasons.push('HS');
	}
	return seasons;
}

function mapModuleType(rawType: string | undefined): ModuleType | undefined {
	if (rawType === undefined || !(rawType in MODULE_TYPE_BY_VALUE)) {
		return undefined;
	}
	return MODULE_TYPE_BY_VALUE[rawType];
}

function selectModuleType(
	module: RawModule,
	plan: string,
): ModuleType | undefined {
	const offers = module.ModuleOffers ?? [];
	if (offers.length === 0) return undefined;

	const preferredSeason: string = plan.startsWith('HS')
		? 'Herbst'
		: plan.startsWith('FS')
			? 'Frühling'
			: 'Frühling/Herbst';

	const offersForInformatik = offers.filter(
		(offer) => offer.DegreeProgramme === 'Informatik',
	);
	const candidateOffers =
		offersForInformatik.length > 0 ? offersForInformatik : offers;

	const bySeasonPreference = candidateOffers.find(
		(offer) => offer.CourseOffering === preferredSeason,
	);
	if (bySeasonPreference) return mapModuleType(bySeasonPreference.ModuleType);

	const flexibleOffer = candidateOffers.find(
		(offer) => offer.CourseOffering === 'Frühling/Herbst',
	);
	if (flexibleOffer) return mapModuleType(flexibleOffer.ModuleType);

	return mapModuleType(candidateOffers[0]?.ModuleType);
}

function mapPrerequisites(
	prereqs: RawModule['Prerequisites'],
): PrerequisiteRule[] {
	if (!prereqs) return [];

	const normaliseLink = (
		value?: RawPrerequisiteLink,
	): PrerequisiteLink | undefined => {
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
		prerequisiteLinkType: normaliseLink(rule.PrerequisiteLinkType),
	}));
}

function readModuleEntry(value: unknown, path: string): RawModule {
	const scope = `${path}: module entry`;
	if (typeof value !== 'object' || value === null) {
		fail(scope, 'must be an object');
	}

	if (!('ShortName' in value)) {
		fail(scope, 'missing ShortName id');
	}
	const shortName = value.ShortName;
	if (typeof shortName !== 'string' || shortName.trim() === '') {
		fail(scope, 'missing ShortName id');
	}

	if (!('Name' in value)) {
		fail(scope, 'missing Name');
	}
	const name = value.Name;
	if (typeof name !== 'string' || name.trim() === '') {
		fail(`${scope} "${shortName}"`, 'missing Name');
	}

	if (!('Ects' in value)) {
		fail(`${scope} "${shortName}"`, 'missing Ects');
	}
	const ects = value.Ects;
	if (typeof ects !== 'number' || !Number.isFinite(ects)) {
		fail(`${scope} "${shortName}"`, 'Ects must be a finite number');
	}

	const nameEnglish = 'NameEnglish' in value ? value.NameEnglish : null;
	const moduleOffers = 'ModuleOffers' in value ? value.ModuleOffers : undefined;
	const prerequisites =
		'Prerequisites' in value ? value.Prerequisites : undefined;
	const prerequisiteNote =
		'PrerequisiteNote' in value ? value.PrerequisiteNote : undefined;
	const assessmentLevelPassed =
		'AssessmentLevelPassed' in value ? value.AssessmentLevelPassed : undefined;

	return {
		ShortName: shortName,
		Name: name,
		Ects: ects,
		NameEnglish: typeof nameEnglish === 'string' ? nameEnglish : null,
		// Offer/prerequisite shapes are read tolerantly: absent fields behave
		// exactly like the legacy runtime, which consumed the JSON unvalidated.
		ModuleOffers: Array.isArray(moduleOffers)
			? (moduleOffers as RawModuleOffer[])
			: undefined,
		Prerequisites: Array.isArray(prerequisites)
			? (prerequisites as RawModulePrerequisite[])
			: null,
		PrerequisiteNote:
			typeof prerequisiteNote === 'string' ? prerequisiteNote : null,
		AssessmentLevelPassed:
			typeof assessmentLevelPassed === 'boolean'
				? assessmentLevelPassed
				: undefined,
	};
}

function loadCourses(dataRoot: string): CatalogCourse[] {
	const modulesDir = join(dataRoot, 'hslu_data', 'modules');
	const snapshotPaths = listJsonFiles(modulesDir);

	const ordered: Array<{ semester: SemesterCode; file: RawModule[] }> = [];
	for (const path of snapshotPaths) {
		const basename = path.split('/').at(-1) ?? '';
		const semester = parseSemesterFromPath(path);
		if (!semester) {
			fail(path, `invalid snapshot filename "${basename}"`);
		}
		const data = readEnvelope(path).data;
		if (!Array.isArray(data)) {
			fail(path, 'invalid envelope: "data" must be an array of modules');
		}
		ordered.push({
			semester,
			file: data.map((entry: unknown) => readModuleEntry(entry, path)),
		});
	}
	ordered.sort((a, b) => compareSemester(a.semester, b.semester));

	const moduleIndex = new Map<string, RawModule>();
	// Seasons must be unioned across every semester file: a module's latest
	// entry only carries that one file's offers, so both-season modules look
	// single-season.
	const seasonsByShortName = new Map<string, Set<Season>>();

	for (const entry of ordered) {
		const seenInSnapshot = new Set<string>();
		for (const module of entry.file) {
			if (seenInSnapshot.has(module.ShortName)) {
				fail(
					`${modulesDir}/`,
					`duplicate module id "${module.ShortName}" in snapshot`,
				);
			}
			seenInSnapshot.add(module.ShortName);
			moduleIndex.set(module.ShortName, module);

			const seasons =
				seasonsByShortName.get(module.ShortName) ?? new Set<Season>();
			for (const season of offeredSeasons(module)) seasons.add(season);
			seasonsByShortName.set(module.ShortName, seasons);
		}
	}

	const courses: CatalogCourse[] = [];
	for (const module of moduleIndex.values()) {
		const typeByPlanSeason: CatalogCourse['typeByPlanSeason'] = {};
		for (const [plan, key] of [
			['HS25', 'HS'],
			['FS25', 'FS'],
			['', 'default'],
		] as const) {
			const type = selectModuleType(module, plan);
			if (type !== undefined) typeByPlanSeason[key] = type;
		}

		courses.push({
			id: module.ShortName,
			label: module.NameEnglish?.trim() || module.Name.trim(),
			ects: module.Ects,
			prerequisites: mapPrerequisites(module.Prerequisites ?? []),
			prerequisiteNote: module.PrerequisiteNote || undefined,
			assessmentLevelPassed: module.AssessmentLevelPassed ?? undefined,
			typeByPlanSeason,
			seasons: (['FS', 'HS'] as const).filter((season) =>
				seasonsByShortName.get(module.ShortName)?.has(season),
			),
		});
	}
	return courses;
}

function normaliseModel(segment: string): StudyModel {
	const model = segment.toLowerCase();
	if (model !== 'fulltime' && model !== 'parttime') {
		fail(segment, `invalid study model "${segment}"`);
	}
	return model;
}

function listTemplateFiles(directory: string): string[] {
	let entries: string[];
	try {
		entries = readdirSync(directory);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		fail(directory, `cannot read directory: ${detail}`);
	}
	const result: string[] = [];
	for (const entry of entries) {
		const full = join(directory, entry);
		if (statSync(full).isDirectory()) {
			result.push(...listTemplateFiles(full));
		} else if (entry.endsWith('.json')) {
			result.push(full);
		}
	}
	return result.sort();
}

function readTemplate(path: string): {
	id?: string;
	name: string;
	studiengang?: string;
	programName?: string;
	slots: CurriculumTemplate['slots'];
} {
	const parsed = parseJsonFile(path);
	if (typeof parsed !== 'object' || parsed === null) {
		fail(path, 'invalid template: expected an object');
	}
	// Template files are plain objects (not enveloped); fields are checked below.
	const data = parsed as Record<string, unknown>;

	const name = data.name;
	if (typeof name !== 'string' || name.trim() === '') {
		fail(path, 'template is missing a name');
	}
	const id = data.id;
	if (id !== undefined && typeof id !== 'string') {
		fail(path, 'template id must be a string');
	}
	if (!Array.isArray(data.slots)) {
		fail(path, 'template "slots" must be an array');
	}

	const slots = data.slots.map(
		(slot: unknown, index): CurriculumTemplate['slots'][number] => {
			const scope = `${path}: slot #${index + 1}`;
			if (typeof slot !== 'object' || slot === null) {
				fail(scope, 'slot must be an object');
			}
			// Object-shape verified above; fields are checked below.
			const record = slot as Record<string, unknown>;
			if (typeof record.id !== 'string' || record.id.trim() === '') {
				fail(scope, 'slot is missing an id');
			}
			// Duplicate slot ids are tolerated by the runtime (INF parttime
			// HS24/HS25 both contain elective3-s4), so they are not rejected.
			const type = record.type;
			if (type !== 'fixed' && type !== 'elective' && type !== 'major') {
				fail(scope, `invalid slot type "${String(type)}"`);
			}
			const semester = record.semester;
			if (typeof semester !== 'number' || !Number.isInteger(semester)) {
				fail(scope, 'slot semester must be an integer');
			}
			const normalized: CurriculumTemplate['slots'][number] = {
				id: record.id,
				type,
				semester,
			};
			if (record.courseId !== undefined) {
				if (typeof record.courseId !== 'string') {
					fail(scope, 'slot courseId must be a string');
				}
				// Unresolved fixed course ids (e.g. "MAJOR") are tolerated by
				// the runtime and preserved as-is.
				normalized.courseId = record.courseId;
			}
			return normalized;
		},
	);

	return {
		id: id === undefined ? undefined : id,
		name,
		studiengang:
			typeof data.studiengang === 'string' ? data.studiengang : undefined,
		programName:
			typeof data.programName === 'string' ? data.programName : undefined,
		slots,
	};
}

function loadTemplates(
	dataRoot: string,
	programmes: ProgramInfo[],
): CurriculumTemplate[] {
	const templatesDir = join(dataRoot, 'templates');
	const programmeNameByShort = new Map(
		programmes.map((program) => [program.shortName, program.name]),
	);

	const templates: CurriculumTemplate[] = [];
	const seenIds = new Set<string>();
	for (const path of listTemplateFiles(templatesDir)) {
		const relPath = `./${path.split(`${dataRoot}/`)[1] ?? ''}`;
		const match = TEMPLATE_PATH_REGEX.exec(relPath);
		if (!match) {
			fail(path, 'invalid template filename');
		}

		const [, programSegment, modelSegment, planSegment] = match;
		const programShortName = programSegment.toUpperCase();
		const model = normaliseModel(modelSegment);
		const plan = planSegment.toUpperCase();
		const rawTemplate = readTemplate(path);
		const programName =
			programmeNameByShort.get(programShortName) ??
			rawTemplate.programName ??
			rawTemplate.studiengang ??
			programShortName;

		const template: CurriculumTemplate = {
			id:
				rawTemplate.id ??
				`${programShortName.toLowerCase()}-${model}-${plan.toLowerCase()}`,
			name: rawTemplate.name,
			studiengang: programShortName,
			modell: model,
			plan,
			slots: rawTemplate.slots,
			programShortName,
			programName,
		};

		if (seenIds.has(template.id)) {
			fail(path, `duplicate template id "${template.id}"`);
		}
		seenIds.add(template.id);
		templates.push(template);
	}

	return templates.sort((a, b) => {
		if ((a.programName ?? '') !== (b.programName ?? '')) {
			return (a.programName ?? '').localeCompare(b.programName ?? '');
		}
		if (a.modell !== b.modell) {
			return a.modell.localeCompare(b.modell);
		}
		return a.plan.localeCompare(b.plan);
	});
}

function loadProgrammes(dataRoot: string): ProgramInfo[] {
	const path = join(dataRoot, 'hslu_data', 'study_programmes.json');
	const data = readEnvelope(path).data;
	if (!Array.isArray(data)) {
		fail(path, 'invalid envelope: "data" must be an array of programmes');
	}

	const seen = new Set<string>();
	const programmes = data.map((entry: unknown): ProgramInfo => {
		if (typeof entry !== 'object' || entry === null) {
			fail(path, 'programme entry must be an object');
		}
		// Object-shape verified above; fields are checked below.
		const record = entry as Record<string, unknown>;
		const shortNameRaw = record.ShortName;
		if (typeof shortNameRaw !== 'string' || shortNameRaw.trim() === '') {
			fail(path, 'programme is missing ShortName');
		}
		const name = record.Name;
		if (typeof name !== 'string' || name.trim() === '') {
			fail(`${path}: programme "${shortNameRaw}"`, 'missing Name');
		}
		const shortName = shortNameRaw.toUpperCase();
		if (seen.has(shortName)) {
			fail(path, `duplicate programme id "${shortName}"`);
		}
		seen.add(shortName);
		return { shortName, name };
	});

	return programmes.sort((a, b) => a.name.localeCompare(b.name));
}

function loadEctsRequirements(
	dataRoot: string,
): Record<string, EctsRequirements> {
	const ectsDir = join(dataRoot, 'hslu_data', 'ects');
	const byProgram: Record<string, EctsRequirements> = {};
	for (const path of listJsonFiles(ectsDir)) {
		const match = ECTS_PATH_REGEX.exec(path);
		if (!match) {
			fail(path, 'invalid ECTS filename');
		}
		const data = readEnvelope(path).data;
		if (typeof data !== 'object' || data === null) {
			fail(path, 'invalid envelope: ECTS "data" must be an object');
		}
		// Object-shape verified above; fields are checked below.
		const record = data as Record<string, unknown>;
		const totalEcts = record.TotalECTS;
		if (typeof totalEcts !== 'string' || totalEcts.trim() === '') {
			fail(path, 'missing TotalECTS');
		}
		const total = Number(totalEcts);
		if (!Number.isFinite(total)) {
			fail(path, `invalid TotalECTS value "${totalEcts}"`);
		}
		const perModuleRaw = record.ectsPerModule;
		if (
			typeof perModuleRaw !== 'object' ||
			perModuleRaw === null ||
			Array.isArray(perModuleRaw)
		) {
			fail(path, 'missing ectsPerModule');
		}
		// Object-shape verified above; entries are iterated for validation.
		const perModule: EctsRequirements['perModule'] = {};
		for (const [category, value] of Object.entries(
			perModuleRaw as Record<string, unknown>,
		)) {
			if (!(category in MODULE_TYPE_BY_VALUE)) {
				fail(path, `invalid ECTS category "${category}"`);
			}
			const numeric = Number(value);
			if (!Number.isFinite(numeric)) {
				fail(path, `invalid ECTS value "${String(value)}" for "${category}"`);
			}
			perModule[MODULE_TYPE_BY_VALUE[category]] = numeric;
		}
		byProgram[match[1].toUpperCase()] = { total, perModule };
	}
	return byProgram;
}

function loadDataVersion(dataRoot: string): string {
	const path = join(dataRoot, 'hslu_data', 'latest_semester.json');
	const data = readEnvelope(path).data;
	if (typeof data !== 'string' || data.trim() === '') {
		fail(path, 'latest semester must be a non-empty string');
	}
	const semester = data.trim();
	const snapshot = join(
		dataRoot,
		'hslu_data',
		'modules',
		`${semester}_modules.json`,
	);
	try {
		statSync(snapshot);
	} catch {
		fail(path, `latest semester "${semester}" has no matching snapshot`);
	}
	return semester;
}

export function buildCatalog(dataRoot: string): CatalogData {
	const courses = loadCourses(dataRoot);
	const programmes = loadProgrammes(dataRoot);
	const templates = loadTemplates(dataRoot, programmes);
	const ectsRequirements = loadEctsRequirements(dataRoot);
	const dataVersion = loadDataVersion(dataRoot);

	return {
		schemaVersion: 1,
		dataVersion,
		programmes,
		templates,
		ectsRequirements,
		courses,
	};
}

// Biome-compatible JSON formatting with the generated-file override. A wider
// line keeps the normalized bundle below its enforced size ceiling.
const JSON_LINE_WIDTH = 120;
const JSON_TAB_WIDTH = 4;

function jsonPrimitive(value: unknown): string {
	if (value === null) return 'null';
	switch (typeof value) {
		case 'number':
		case 'boolean':
			return String(value);
		case 'string':
			return JSON.stringify(value);
		default:
			return '';
	}
}

function jsonEntries(value: unknown): Array<[string, unknown]> {
	return Object.entries(value as Record<string, unknown>).filter(
		([, entry]) => entry !== undefined,
	);
}

function jsonFlat(value: unknown): string {
	if (value === null || typeof value !== 'object') {
		return jsonPrimitive(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map((entry) => jsonFlat(entry)).join(', ')}]`;
	}
	const entries = jsonEntries(value);
	if (entries.length === 0) return '{}';
	return `{ ${entries
		.map(([key, entry]) => `${JSON.stringify(key)}: ${jsonFlat(entry)}`)
		.join(', ')} }`;
}

function jsonFormat(value: unknown, indent: number, column: number): string {
	if (value === null || typeof value !== 'object') {
		return jsonPrimitive(value);
	}

	if (Array.isArray(value)) {
		const flat = jsonFlat(value);
		if (column + flat.length <= JSON_LINE_WIDTH) return flat;

		const innerIndent = indent + 1;
		const parts = value.map(
			(entry) =>
				`${'\t'.repeat(innerIndent)}${jsonFormat(
					entry,
					innerIndent,
					innerIndent * JSON_TAB_WIDTH,
				)}`,
		);
		return `[\n${parts.join(',\n')}\n${'\t'.repeat(indent)}]`;
	}

	const entries = jsonEntries(value);
	const flat = jsonFlat(value);
	if (column + flat.length <= JSON_LINE_WIDTH) return flat;

	const innerIndent = indent + 1;
	const parts = entries.map(([key, entry]) => {
		const keyPrefix = `${JSON.stringify(key)}: `;
		const valueColumn = innerIndent * JSON_TAB_WIDTH + keyPrefix.length;
		return `${'\t'.repeat(innerIndent)}${keyPrefix}${jsonFormat(
			entry,
			innerIndent,
			valueColumn,
		)}`;
	});
	return `{\n${parts.join(',\n')}\n${'\t'.repeat(indent)}}`;
}

export function serializeCatalog(catalog: CatalogData): string {
	return `${jsonFormat(catalog, 0, 0)}\n`;
}

function projectRoot(): string {
	const cwd = process.cwd();
	return cwd.endsWith('frontend') ? cwd : join(cwd, 'frontend');
}

function main(): void {
	const args = process.argv.slice(2);
	const checkOnly = args.includes('--check');
	const dataRoot = join(projectRoot(), 'src', 'lib', 'data');
	const outputPath = join(dataRoot, 'catalog.generated.json');

	const catalog = buildCatalog(dataRoot);
	const serialized = serializeCatalog(catalog);

	if (checkOnly) {
		let existing: string;
		try {
			existing = readFileSync(outputPath, 'utf8');
		} catch {
			existing = '';
		}
		if (existing !== serialized) {
			process.stderr.write(
				'Catalog bundle is out of date. Run "bun run catalog:generate".\n',
			);
			process.exit(1);
		}
		return;
	}

	writeFileSync(outputPath, serialized);
	console.log(
		`Wrote ${outputPath} (${serialized.length} bytes, ${catalog.courses.length} courses).`,
	);
}

if (import.meta.main) {
	main();
}
