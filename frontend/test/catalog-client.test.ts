import { beforeEach, describe, expect, test } from 'bun:test';
import { createCatalogClient } from '../src/lib/data/catalog-client';
import type { CatalogData } from '../src/lib/data/catalog-types';

const VALID_CATALOG: CatalogData = {
	schemaVersion: 1,
	dataVersion: 'H25',
	programmes: [{ shortName: 'INF', name: 'Informatik' }],
	templates: [],
	ectsRequirements: { INF: { total: 180, perModule: {} } },
	courses: [],
};

type FetchCall = { url: string; init: RequestInit | undefined };

function jsonResponse(body: string, status = 200): Response {
	return new Response(body, {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

function makeFetch(responder: (url: string) => Response | Promise<Response>): {
	fetchFn: typeof fetch;
	calls: FetchCall[];
} {
	const calls: FetchCall[] = [];
	const fetchFn = ((url: string, init?: RequestInit) => {
		calls.push({ url, init });
		return Promise.resolve(responder(url));
	}) as typeof fetch;
	return { fetchFn, calls };
}

const URL = '/assets/catalog.json';

describe('catalog client', () => {
	let calls: FetchCall[];

	function clientRespondingWith(
		responder: (url: string) => Response | Promise<Response>,
	) {
		const made = makeFetch(responder);
		calls = made.calls;
		return createCatalogClient(URL, made.fetchFn);
	}

	beforeEach(() => {
		calls = [];
	});

	test('parses and exposes a successful catalog', async () => {
		const client = clientRespondingWith(() =>
			jsonResponse(JSON.stringify(VALID_CATALOG)),
		);

		const loaded = await client.load();
		expect(loaded.dataVersion).toBe('H25');
		expect(client.get()).toBe(loaded);
	});

	test('sends the configured URL without credentials', async () => {
		const client = clientRespondingWith(() =>
			jsonResponse(JSON.stringify(VALID_CATALOG)),
		);

		await client.load();

		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe(URL);
		expect(calls[0].init?.credentials).toBe('omit');
		expect(calls[0].init?.headers).toEqual({
			Accept: 'application/json',
		});
	});

	test('shares one request between concurrent loads', async () => {
		const client = clientRespondingWith(() =>
			jsonResponse(JSON.stringify(VALID_CATALOG)),
		);

		const [a, b] = await Promise.all([client.load(), client.load()]);

		expect(calls).toHaveLength(1);
		expect(b).toBe(a);
	});

	test('reuses the value for repeated successful loads', async () => {
		const client = clientRespondingWith(() =>
			jsonResponse(JSON.stringify(VALID_CATALOG)),
		);

		const first = await client.load();
		const second = await client.load();

		expect(calls).toHaveLength(1);
		expect(second).toBe(first);
	});

	test('rejects non-2xx responses with status message', async () => {
		const client = clientRespondingWith(() => jsonResponse('', 503));

		await expect(client.load()).rejects.toThrow(
			'Catalog request failed with status 503.',
		);
		expect(client.get).toThrow('Catalog has not been loaded.');
	});

	test('rejects invalid JSON bodies', async () => {
		const client = clientRespondingWith(() => jsonResponse('<html>'));

		await expect(client.load()).rejects.toThrow(
			'Catalog response is not valid JSON.',
		);
	});

	test('rejects unsupported schema versions', async () => {
		const client = clientRespondingWith(() =>
			jsonResponse(JSON.stringify({ ...VALID_CATALOG, schemaVersion: 2 })),
		);

		await expect(client.load()).rejects.toThrow(
			'Unsupported catalog schema version: 2',
		);
	});

	test('rejects invalid top-level shapes', async () => {
		for (const broken of [
			null,
			{},
			{ ...VALID_CATALOG, dataVersion: 42 },
			{ ...VALID_CATALOG, programmes: 'nope' },
			{ ...VALID_CATALOG, templates: undefined },
			{ ...VALID_CATALOG, courses: null },
			{ ...VALID_CATALOG, ectsRequirements: null },
		]) {
			const client = clientRespondingWith(() =>
				jsonResponse(JSON.stringify(broken)),
			);
			await expect(client.load()).rejects.toThrow(
				'Catalog response has an invalid shape.',
			);
		}
	});

	test('makes a real second request after a failure', async () => {
		let failing = true;
		const client = clientRespondingWith(() =>
			failing
				? jsonResponse('', 503)
				: jsonResponse(JSON.stringify(VALID_CATALOG)),
		);

		await expect(client.load()).rejects.toThrow();
		failing = false;

		const retried = await client.load();
		expect(retried.dataVersion).toBe('H25');
		expect(calls).toHaveLength(2);
	});

	test('retries after an injected fetch throws synchronously', async () => {
		let failing = true;
		const client = clientRespondingWith(() => {
			if (failing) {
				failing = false;
				throw new Error('Synchronous fetch failure.');
			}
			return jsonResponse(JSON.stringify(VALID_CATALOG));
		});

		await expect(client.load()).rejects.toThrow('Synchronous fetch failure.');

		const retried = await client.load();
		expect(retried.dataVersion).toBe('H25');
		expect(calls).toHaveLength(2);
	});

	test('initializes the template index during identifier lookup', async () => {
		const template = {
			id: 'informatik-fulltime-hs25',
			name: 'Informatik Fulltime HS25',
			studiengang: 'INF',
			modell: 'fulltime',
			plan: 'HS25',
			slots: [],
		} as const;
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (() =>
			Promise.resolve(
				jsonResponse(
					JSON.stringify({ ...VALID_CATALOG, templates: [template] }),
				),
			)) as typeof fetch;

		// Dynamic imports ensure catalog-loader captures this test fetch.
		try {
			const { loadCatalog } = await import('../src/lib/data/catalog-loader');
			await loadCatalog();
			const { getTemplateById } = await import('../src/lib/data/courses');

			expect(getTemplateById(template.id)).toEqual(template);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
