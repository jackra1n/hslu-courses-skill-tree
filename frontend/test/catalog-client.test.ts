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

		expect(client.load()).rejects.toThrow(
			'Catalog request failed with status 503.',
		);
		expect(client.get).toThrow('Catalog has not been loaded.');
	});

	test('rejects invalid JSON bodies', async () => {
		const client = clientRespondingWith(() => jsonResponse('<html>'));

		expect(client.load()).rejects.toThrow(
			'Catalog response is not valid JSON.',
		);
	});

	test('rejects unsupported schema versions', async () => {
		const client = clientRespondingWith(() =>
			jsonResponse(JSON.stringify({ ...VALID_CATALOG, schemaVersion: 2 })),
		);

		expect(client.load()).rejects.toThrow(
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
			expect(client.load()).rejects.toThrow(
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
});
