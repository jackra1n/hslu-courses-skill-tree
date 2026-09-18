import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import worker from '../index';
import { applyMigrations, resetTestData, seedUser } from './apply-migrations';

function request(
	method: string,
	path: string,
	init: RequestInit = {},
): Request {
	return new Request(`https://hsluskilltree.com${path}`, {
		method,
		...init,
		headers: { host: 'hsluskilltree.com', ...init.headers },
	});
}

beforeEach(async () => {
	await applyMigrations();
	await resetTestData();
	await seedUser('reviewer-1');
	await seedUser('reviewer-2');
});

describe('public course reviews', () => {
	it('distinguishes an unrated course from an unknown course', async () => {
		const response = await worker.fetch(
			request('GET', '/api/courses/WEBLAB/reviews'),
			env,
		);
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(await response.json()).toEqual({
			reviews: [],
			summary: {
				count: 0,
				recommendation: null,
				contentInterest: null,
				difficulty: null,
				workload: null,
			},
		});
		const unknown = await worker.fetch(
			request('GET', '/api/courses/NOT-A-COURSE/reviews'),
			env,
		);
		expect(unknown.status).toBe(404);
	});

	it('returns only the requested course, newest first, with separate averages and no private author data', async () => {
		await env.DB.prepare(`INSERT INTO reviews
			(id, course_id, user_id, recommendation, content_interest, difficulty, workload, created_at, updated_at)
			VALUES
			('old', 'WEBLAB', 'reviewer-1', 1, 2, 2, 3, 100, 100),
			('new', 'WEBLAB', 'reviewer-2', 5, 3, 2, 4, 200, 200),
			('other-course', 'AINF', 'reviewer-1', 5, 5, 5, 5, 300, 300)`).run();
		const response = await worker.fetch(
			request('GET', '/api/courses/WEBLAB/reviews'),
			env,
		);
		expect(response.status).toBe(200);
		const body = await response.json<{
			reviews: { id: string; authorName: string }[];
			summary: unknown;
		}>();
		expect(body.reviews.map((review) => review.id)).toEqual(['new', 'old']);
		expect(body.reviews[0].authorName).toBe('Test reviewer-2');
		expect(body.summary).toEqual({
			count: 2,
			recommendation: 3,
			contentInterest: 2.5,
			difficulty: 2,
			workload: 3.5,
		});
		expect(JSON.stringify(body)).not.toContain('@test.example');
	});

	it('decodes real catalog IDs and rejects malformed URL encoding', async () => {
		for (const courseId of ['DB&S', 'SIM+MOD']) {
			const response = await worker.fetch(
				request('GET', `/api/courses/${encodeURIComponent(courseId)}/reviews`),
				env,
			);
			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({ summary: { count: 0 } });
		}
		const malformed = await worker.fetch(
			request('GET', '/api/courses/%ZZ/reviews'),
			env,
		);
		expect(malformed.status).toBe(400);
	});
});
