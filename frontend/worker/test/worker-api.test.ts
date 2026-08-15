import { env as testEnv } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import worker from '../index';
import { applyMigrations } from './apply-migrations';

const SNAPSHOT = {
	version: 1,
	currentTemplateId: 'bsc-informatik',
	start: { season: 'HS', year: 2026 },
	studyPlans: {},
	slotStatus: {},
	preferences: {
		showShortNamesOnly: false,
		showCourseTypeBadges: false,
		theme: 'light',
	},
};

function request(method: string, url: string, init: RequestInit = {}): Request {
	return new Request(url, {
		method,
		...init,
		// Dynamic baseURL resolution reads the Host header; real Worker
		// requests always carry it, constructed test requests do not.
		headers: { host: new URL(url).host, ...init.headers },
	});
}

async function dispatch(request: Request): Promise<Response> {
	const response = await worker.fetch(request, env);
	return response;
}

beforeEach(async () => {
	await applyMigrations();
});

describe('worker /api router', () => {
	it('returns 401 for /api/progress without a session', async () => {
		const res = await dispatch(
			request('GET', 'https://hsluskilltree.com/api/progress'),
		);
		expect(res.status).toBe(401);
	});

	it('returns 403 for PUT /api/progress with a missing or mismatched Origin', async () => {
		const body = JSON.stringify({ data: SNAPSHOT, expectedRevision: null });
		const noOrigin = await dispatch(
			request('PUT', 'https://hsluskilltree.com/api/progress', { body }),
		);
		expect(noOrigin.status).toBe(403);

		const evilOrigin = await dispatch(
			request('PUT', 'https://hsluskilltree.com/api/progress', {
				body,
				headers: { Origin: 'https://evil.example.com' },
			}),
		);
		expect(evilOrigin.status).toBe(403);
	});

	it('returns 401 for PUT with a valid Origin but no session', async () => {
		const res = await dispatch(
			request('PUT', 'https://hsluskilltree.com/api/progress', {
				body: JSON.stringify({ data: SNAPSHOT, expectedRevision: null }),
				headers: { Origin: 'https://hsluskilltree.com' },
			}),
		);
		expect(res.status).toBe(401);
	});

	it('returns 405 with Allow header for wrong methods on /api/progress', async () => {
		const res = await dispatch(
			request('POST', 'https://hsluskilltree.com/api/progress'),
		);
		expect(res.status).toBe(405);
		expect(res.headers.get('Allow')).toBe('GET, PUT');
	});

	it('returns 404 JSON for unknown /api routes', async () => {
		const res = await dispatch(
			request('GET', 'https://hsluskilltree.com/api/unknown'),
		);
		expect(res.status).toBe(404);
		expect(res.headers.get('Content-Type')).toContain('application/json');
	});

	it('serves /api/auth/get-session without a server error', async () => {
		const res = await dispatch(
			request('GET', 'https://hsluskilltree.com/api/auth/get-session'),
		);
		expect(res.status).toBe(200);
		// Better Auth returns a JSON null body for signed-out sessions.
		expect(await res.json()).toBeNull();
	});

	it('delegates /api/auth routes to better auth', async () => {
		const res = await dispatch(
			request('GET', 'https://hsluskilltree.com/api/auth/error', {
				headers: { Origin: 'http://localhost:5173' },
			}),
		);
		// Better Auth serves its own error page; any non-500 proves delegation.
		expect(res.status).not.toBe(500);
	});

	it('creates no user_data row for anonymous traffic', async () => {
		await dispatch(request('GET', 'https://hsluskilltree.com/api/progress'));
		const rows = await testEnv.DB.prepare(
			'SELECT COUNT(*) AS count FROM user_data',
		).first<{
			count: number;
		}>();
		expect(rows?.count).toBe(0);
	});
});
