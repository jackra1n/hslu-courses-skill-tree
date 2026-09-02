import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

type JsonObject = Record<string, unknown>;

const projectRoot = resolve(import.meta.dir, '..');
const messagesRoot = resolve(projectRoot, 'messages');
const sourceRoot = resolve(projectRoot, 'src');
const localePattern = /^[A-Za-z0-9-]+$/;
const placeholderPattern = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
const messageImportPattern =
	/import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]\$lib\/paraglide\/messages['"]/u;
const sourceFilePattern = /\.(?:svelte|ts)$/u;

function displayPath(path: string): string {
	return relative(projectRoot, path);
}

function parseObject(path: string, errors: string[]): JsonObject | null {
	try {
		const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
		if (value === null || typeof value !== 'object' || Array.isArray(value)) {
			errors.push(`${displayPath(path)}: expected a JSON object`);
			return null;
		}
		return value as JsonObject;
	} catch (error) {
		errors.push(
			`${displayPath(path)}: invalid JSON (${error instanceof Error ? error.message : String(error)})`,
		);
		return null;
	}
}

function getPlaceholders(value: string): string[] {
	return [...value.matchAll(placeholderPattern)]
		.map((match) => match[1])
		.sort();
}

function listFiles(directory: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) files.push(...listFiles(path));
		else files.push(path);
	}
	return files;
}

function lineNumber(source: string, offset: number): number {
	return source.slice(0, offset).split('\n').length;
}

function checkCatalogs(errors: string[]): Set<string> | null {
	const settingsPath = resolve(projectRoot, 'project.inlang/settings.json');
	const settings = parseObject(settingsPath, errors);
	if (!settings) return null;

	if (
		typeof settings.baseLocale !== 'string' ||
		!localePattern.test(settings.baseLocale)
	) {
		errors.push(
			'project.inlang/settings.json: baseLocale must be a locale identifier',
		);
		return null;
	}

	if (
		!Array.isArray(settings.locales) ||
		settings.locales.some(
			(locale) => typeof locale !== 'string' || !localePattern.test(locale),
		)
	) {
		errors.push(
			'project.inlang/settings.json: locales must be an array of locale identifiers',
		);
		return null;
	}

	const catalogs: Record<string, JsonObject> = {};
	for (const locale of settings.locales as string[]) {
		const path = resolve(messagesRoot, `${locale}.json`);
		try {
			statSync(path);
		} catch {
			errors.push(`${displayPath(path)}: catalog is missing`);
			continue;
		}

		const catalog = parseObject(path, errors);
		if (!catalog) continue;
		catalogs[locale] = catalog;

		for (const [key, value] of Object.entries(catalog)) {
			if (key === '$schema') continue;
			if (typeof value !== 'string' || value.trim() === '') {
				errors.push(
					`${displayPath(path)}: ${key} must have a non-empty string value`,
				);
			}
		}
	}

	const base = catalogs[settings.baseLocale];
	if (!base) {
		errors.push(
			`project.inlang/settings.json: base locale ${settings.baseLocale} has no catalog`,
		);
		return null;
	}

	const baseKeys = Object.keys(base)
		.filter((key) => key !== '$schema')
		.sort();
	const baseKeySet = new Set(baseKeys);
	for (const [locale, catalog] of Object.entries(catalogs)) {
		if (locale === settings.baseLocale) continue;
		const path = resolve(messagesRoot, `${locale}.json`);
		const keys = Object.keys(catalog)
			.filter((key) => key !== '$schema')
			.sort();
		for (const key of baseKeys) {
			if (!Object.hasOwn(catalog, key))
				errors.push(`${displayPath(path)}: missing translation ${key}`);
		}
		for (const key of keys) {
			if (!baseKeySet.has(key))
				errors.push(`${displayPath(path)}: unknown translation key ${key}`);
		}

		for (const key of baseKeys) {
			const baseValue = base[key];
			const translatedValue = catalog[key];
			if (typeof baseValue !== 'string' || typeof translatedValue !== 'string')
				continue;
			const expected = getPlaceholders(baseValue);
			const actual = getPlaceholders(translatedValue);
			if (expected.join('\0') !== actual.join('\0')) {
				errors.push(
					`${displayPath(path)}: ${key} has placeholders ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
				);
			}
		}
	}

	return baseKeySet;
}

function checkMessageReferences(baseKeys: Set<string>, errors: string[]): void {
	for (const path of listFiles(sourceRoot).filter((file) =>
		sourceFilePattern.test(file),
	)) {
		if (path.includes('/paraglide/')) continue;
		const source = readFileSync(path, 'utf8');
		const importMatch = source.match(messageImportPattern);
		if (!importMatch) continue;

		const namespace = importMatch[1].replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
		const usagePattern = new RegExp(
			`\\b${namespace}\\.([A-Za-z][A-Za-z0-9_]*)\\s*\\(`,
			'gu',
		);
		for (const match of source.matchAll(usagePattern)) {
			const key = match[1];
			if (!baseKeys.has(key)) {
				errors.push(
					`${displayPath(path)}:${lineNumber(source, match.index ?? 0)}: unknown translation key ${key}`,
				);
			}
		}
	}
}

const errors: string[] = [];
const baseKeys = checkCatalogs(errors);
if (baseKeys) checkMessageReferences(baseKeys, errors);

if (errors.length > 0) {
	console.error(
		`i18n check failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:`,
	);
	for (const error of errors) console.error(`- ${error}`);
	process.exitCode = 1;
} else {
	console.log(
		'i18n check passed: catalogs and message references are consistent.',
	);
}
