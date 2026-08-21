import type { CatalogData } from './catalog-types';

export type CatalogClient = {
	load(): Promise<CatalogData>;
	get(): CatalogData;
};

function validateShape(value: unknown): CatalogData {
	const data = value as Record<string, unknown> | null;
	if (
		!data ||
		typeof data.dataVersion !== 'string' ||
		!Array.isArray(data.programmes) ||
		!Array.isArray(data.templates) ||
		!Array.isArray(data.courses) ||
		!data.ectsRequirements ||
		typeof data.ectsRequirements !== 'object'
	) {
		throw new Error('Catalog response has an invalid shape.');
	}
	return data as unknown as CatalogData;
}

export function createCatalogClient(
	url: string,
	fetchFn: typeof fetch,
): CatalogClient {
	let value: CatalogData | undefined;
	let pending: Promise<CatalogData> | undefined;

	async function request(): Promise<CatalogData> {
		try {
			const response = await fetchFn(url, {
				credentials: 'omit',
				headers: { Accept: 'application/json' },
			});
			if (!response.ok) {
				throw new Error(`Catalog request failed with status ${response.status}.`);
			}
			let parsed: unknown;
			try {
				parsed = await response.json();
			} catch {
				throw new Error('Catalog response is not valid JSON.');
			}
			const data = validateShape(parsed);
			if (data.schemaVersion !== 1) {
				throw new Error(
					`Unsupported catalog schema version: ${data.schemaVersion}`,
				);
			}
			value = data;
			return data;
		} finally {
			pending = undefined;
		}
	}

	return {
		load() {
			if (value) return Promise.resolve(value);
			pending ??= request();
			return pending;
		},
		get() {
			if (!value) {
				throw new Error('Catalog has not been loaded.');
			}
			return value;
		},
	};
}
