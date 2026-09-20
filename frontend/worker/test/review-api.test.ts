import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
	CourseReviewScore,
	CourseReviewsResponse,
	Review,
} from '../../src/lib/data/review-types';
import { getAuth } from '../auth';
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

const INPUT = {
	recommendation: 5,
	contentInterest: 4,
	difficulty: 2,
	workload: 3,
};

// real sessions and signed cookies exercise Better Auth, not an auth mock.
async function sessionCookie(userId: string): Promise<string> {
	const context = await getAuth().$context;
	const session = await context.internalAdapter.createSession(userId);
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(context.secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const signature = await crypto.subtle.sign(
		'HMAC',
		key,
		encoder.encode(session.token),
	);
	const signed = `${session.token}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
	return `${context.authCookies.sessionToken.name}=${encodeURIComponent(signed)}`;
}

function writeReview(
	method: string,
	path: string,
	cookie: string,
	body: unknown = INPUT,
): Promise<Response> {
	return worker.fetch(
		request(method, path, {
			headers: {
				Origin: 'https://hsluskilltree.com',
				Cookie: cookie,
				'Content-Type': 'application/json',
			},
			body: method === 'DELETE' ? undefined : JSON.stringify(body),
		}),
		env,
	);
}

beforeEach(async () => {
	await applyMigrations();
	await resetTestData();
	await seedUser('reviewer-1');
	await seedUser('reviewer-2');
});

describe('public course review scores', () => {
	it('averages recommendations per course without identity data and removes courses after their last review is deleted', async () => {
		const empty = await worker.fetch(
			request('GET', '/api/course-review-scores'),
			env,
		);
		expect(empty.status).toBe(200);
		expect(await empty.json()).toEqual({ scores: [] });

		await env.DB.prepare(`INSERT INTO reviews
			(id, course_id, user_id, recommendation, content_interest, difficulty, workload, created_at, updated_at)
			VALUES
			('first', 'WEBLAB', 'reviewer-1', 1, 5, 4, 3, 100, 100),
			('second', 'WEBLAB', 'reviewer-2', 4, 2, 1, 5, 200, 200),
			('other-course', 'AINF', 'reviewer-1', 5, 1, 3, 2, 300, 300)`).run();
		const response = await worker.fetch(
			request('GET', '/api/course-review-scores'),
			env,
		);
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		const body = await response.json<{ scores: CourseReviewScore[] }>();
		body.scores.sort((a, b) => a.courseId.localeCompare(b.courseId));
		expect(body).toEqual({
			scores: [
				{ courseId: 'AINF', recommendation: 5, count: 1 },
				{ courseId: 'WEBLAB', recommendation: 2.5, count: 2 },
			],
		});

		const firstReviewer = await sessionCookie('reviewer-1');
		expect(
			(await writeReview('DELETE', '/api/reviews/other-course', firstReviewer))
				.status,
		).toBe(204);
		expect(
			(await writeReview('DELETE', '/api/reviews/first', firstReviewer)).status,
		).toBe(204);
		const afterDelete = await worker.fetch(
			request('GET', '/api/course-review-scores'),
			env,
		);
		expect(await afterDelete.json()).toEqual({
			scores: [{ courseId: 'WEBLAB', recommendation: 4, count: 1 }],
		});

		const secondReviewer = await sessionCookie('reviewer-2');
		expect(
			(await writeReview('DELETE', '/api/reviews/second', secondReviewer))
				.status,
		).toBe(204);
		const afterLastDelete = await worker.fetch(
			request('GET', '/api/course-review-scores'),
			env,
		);
		expect(await afterLastDelete.json()).toEqual({ scores: [] });
	});

	it('allows only GET without requiring authentication or a write origin', async () => {
		for (const method of [
			'POST',
			'PUT',
			'PATCH',
			'DELETE',
			'HEAD',
			'OPTIONS',
		]) {
			const response = await worker.fetch(
				request(method, '/api/course-review-scores'),
				env,
			);
			expect(response.status).toBe(405);
			expect(response.headers.get('Allow')).toBe('GET');
		}
	});
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
			ownReviewId: null,
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

	it('returns anonymous reviews with ownership scoped to the requesting user and course', async () => {
		await seedUser('reviewer-3');
		await env.DB.prepare(`INSERT INTO reviews
			(id, course_id, user_id, recommendation, content_interest, difficulty, workload, created_at, updated_at)
			VALUES
			('old', 'WEBLAB', 'reviewer-1', 1, 2, 2, 3, 100, 100),
			('new', 'WEBLAB', 'reviewer-2', 5, 3, 2, 4, 200, 200),
			('other-course', 'AINF', 'reviewer-3', 5, 5, 5, 5, 300, 300)`).run();
		const first = await sessionCookie('reviewer-1');
		const second = await sessionCookie('reviewer-2');
		const otherCourse = await sessionCookie('reviewer-3');
		for (const [cookie, ownReviewId] of [
			['', null],
			[first, 'old'],
			[second, 'new'],
			[otherCourse, null],
			[first.replace('=', '=tampered'), null],
		] as const) {
			const response = await worker.fetch(
				request('GET', '/api/courses/WEBLAB/reviews', {
					headers: { Cookie: cookie },
				}),
				env,
			);
			expect(response.status).toBe(200);
			expect(response.headers.get('Cache-Control')).toBe('no-store');
			const body = await response.json<CourseReviewsResponse>();
			expect(body).toEqual({
				ownReviewId,
				reviews: [
					{
						id: 'new',
						courseId: 'WEBLAB',
						recommendation: 5,
						contentInterest: 3,
						difficulty: 2,
						workload: 4,
						text: '',
						createdAt: 200,
						updatedAt: 200,
					},
					{
						id: 'old',
						courseId: 'WEBLAB',
						recommendation: 1,
						contentInterest: 2,
						difficulty: 2,
						workload: 3,
						text: '',
						createdAt: 100,
						updatedAt: 100,
					},
				],
				summary: {
					count: 2,
					recommendation: 3,
					contentInterest: 2.5,
					difficulty: 2,
					workload: 3.5,
				},
			});
		}
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

describe('authenticated review writes', () => {
	it('persists create, replacement and deletion, updating public summaries each time', async () => {
		const cookie = await sessionCookie('reviewer-1');
		const text = "Grüsse 🧠'; DROP TABLE reviews; --";
		const created = await writeReview(
			'POST',
			'/api/courses/WEBLAB/reviews',
			cookie,
			{ ...INPUT, text },
		);
		expect(created.status).toBe(201);
		const body = await created.json<{ review: Review }>();
		expect(body).toEqual({
			review: {
				id: expect.any(String),
				courseId: 'WEBLAB',
				...INPUT,
				text,
				createdAt: expect.any(Number),
				updatedAt: expect.any(Number),
			},
		});
		const { review } = body;
		const path = `/api/reviews/${review.id}`;
		const listed = await worker.fetch(
			request('GET', '/api/courses/WEBLAB/reviews'),
			env,
		);
		expect(await listed.json()).toMatchObject({
			reviews: [{ id: review.id, text }],
			summary: { count: 1, ...INPUT },
		});

		const replacement = { ...INPUT, recommendation: 2, workload: 5 };
		const updated = await writeReview('PUT', path, cookie, replacement);
		expect(updated.status).toBe(200);
		expect(await updated.json()).toEqual({
			review: {
				id: review.id,
				courseId: 'WEBLAB',
				createdAt: review.createdAt,
				updatedAt: expect.any(Number),
				text: '',
				...replacement,
			},
		});
		const afterUpdate = await worker.fetch(
			request('GET', '/api/courses/WEBLAB/reviews'),
			env,
		);
		expect(await afterUpdate.json()).toMatchObject({
			summary: { count: 1, ...replacement },
		});

		const deleted = await writeReview('DELETE', path, cookie);
		expect(deleted.status).toBe(204);
		expect(await deleted.text()).toBe('');
		const afterDelete = await worker.fetch(
			request('GET', '/api/courses/WEBLAB/reviews'),
			env,
		);
		expect(await afterDelete.json()).toMatchObject({
			reviews: [],
			summary: { count: 0, recommendation: null, workload: null },
		});
		expect((await writeReview('DELETE', path, cookie)).status).toBe(404);
		expect(
			(await writeReview('POST', '/api/courses/WEBLAB/reviews', cookie)).status,
		).toBe(201);
	});

	it('allows only the author to edit or delete and rejects unsigned or tampered sessions', async () => {
		const owner = await sessionCookie('reviewer-1');
		const other = await sessionCookie('reviewer-2');
		const created = await writeReview(
			'POST',
			'/api/courses/WEBLAB/reviews',
			owner,
		);
		expect(created.status).toBe(201);
		const { review } = await created.json<{ review: { id: string } }>();
		const path = `/api/reviews/${review.id}`;
		for (const method of ['PUT', 'DELETE']) {
			expect(
				(
					await writeReview(method, path, other, {
						...INPUT,
						recommendation: 1,
					})
				).status,
			).toBe(404);
			expect((await writeReview(method, path, '')).status).toBe(401);
			expect(
				(await writeReview(method, '/api/reviews/missing', owner)).status,
			).toBe(404);
		}
		expect(
			(await writeReview('POST', '/api/courses/AINF/reviews', '')).status,
		).toBe(401);
		expect(
			(
				await writeReview(
					'POST',
					'/api/courses/AINF/reviews',
					owner.replace('=', '=tampered'),
				)
			).status,
		).toBe(401);
		const listed = await worker.fetch(
			request('GET', '/api/courses/WEBLAB/reviews'),
			env,
		);
		expect(await listed.json()).toMatchObject({
			reviews: [{ id: review.id, ...INPUT }],
			ownReviewId: null,
			summary: { count: 1, ...INPUT },
		});
	});

	it('rejects missing or foreign origins on every write even with a valid session', async () => {
		const cookie = await sessionCookie('reviewer-1');
		const created = await writeReview(
			'POST',
			'/api/courses/WEBLAB/reviews',
			cookie,
		);
		const { review } = await created.json<{ review: { id: string } }>();
		for (const method of ['POST', 'PUT', 'DELETE']) {
			const path =
				method === 'POST'
					? '/api/courses/AINF/reviews'
					: `/api/reviews/${review.id}`;
			for (const origin of [null, 'https://hsluskilltree.com.evil.example']) {
				const headers: Record<string, string> = { Cookie: cookie };
				if (origin) headers.Origin = origin;
				const response = await worker.fetch(
					request(method, path, {
						headers,
						body:
							method === 'DELETE'
								? undefined
								: JSON.stringify({ ...INPUT, recommendation: 1 }),
					}),
					env,
				);
				expect(response.status).toBe(403);
			}
		}
		const rows = await env.DB.prepare(
			'SELECT id, recommendation FROM reviews',
		).all();
		expect(rows.results).toEqual([{ id: review.id, recommendation: 5 }]);
	});

	it('returns a conflict for concurrent duplicate creation without replacing the first review', async () => {
		const cookie = await sessionCookie('reviewer-1');
		const responses = await Promise.all([
			writeReview('POST', '/api/courses/WEBLAB/reviews', cookie, {
				...INPUT,
				recommendation: 1,
			}),
			writeReview('POST', '/api/courses/WEBLAB/reviews', cookie, {
				...INPUT,
				recommendation: 5,
			}),
		]);
		expect(responses.map((response) => response.status).sort()).toEqual([
			201, 409,
		]);
		const winner = responses[0].status === 201 ? responses[0] : responses[1];
		const { review } = await winner.json<{
			review: { id: string; recommendation: number };
		}>();
		const listed = await worker.fetch(
			request('GET', '/api/courses/WEBLAB/reviews'),
			env,
		);
		expect(await listed.json()).toMatchObject({
			reviews: [{ id: review.id, recommendation: review.recommendation }],
			summary: { count: 1, recommendation: review.recommendation },
		});
	});

	it('validates input before persistence and does not accept client-supplied ownership or course changes', async () => {
		const cookie = await sessionCookie('reviewer-1');
		const invalid = [
			null,
			[],
			{},
			{ ...INPUT, recommendation: 0 },
			{ ...INPUT, contentInterest: 6 },
			{ ...INPUT, difficulty: 1.5 },
			{ ...INPUT, workload: '3' },
			{ ...INPUT, text: null },
			{ ...INPUT, text: 'x'.repeat(5_001) },
			{ ...INPUT, userId: 'reviewer-2' },
		];
		for (const body of invalid) {
			expect(
				(await writeReview('POST', '/api/courses/WEBLAB/reviews', cookie, body))
					.status,
			).toBe(400);
		}
		for (const body of ['{', undefined]) {
			const response = await worker.fetch(
				request('POST', '/api/courses/WEBLAB/reviews', {
					headers: { Cookie: cookie, Origin: 'https://hsluskilltree.com' },
					body,
				}),
				env,
			);
			expect(response.status).toBe(400);
		}
		expect(
			(await writeReview('POST', '/api/courses/NOT-A-COURSE/reviews', cookie))
				.status,
		).toBe(404);
		const count = await env.DB.prepare(
			'SELECT COUNT(*) AS count FROM reviews',
		).first<number>('count');
		expect(count).toBe(0);

		const created = await writeReview(
			'POST',
			'/api/courses/WEBLAB/reviews',
			cookie,
		);
		const { review } = await created.json<{ review: { id: string } }>();
		for (const body of [
			{ ...INPUT, recommendation: 6 },
			{ ...INPUT, courseId: 'AINF' },
		]) {
			expect(
				(await writeReview('PUT', `/api/reviews/${review.id}`, cookie, body))
					.status,
			).toBe(400);
		}
		const listed = await worker.fetch(
			request('GET', '/api/courses/WEBLAB/reviews'),
			env,
		);
		expect(await listed.json()).toMatchObject({
			reviews: [{ id: review.id, ...INPUT }],
		});
	});

	it('accepts the text boundary but rejects an oversized UTF-8 body before parsing', async () => {
		const cookie = await sessionCookie('reviewer-1');
		const text = 'é'.repeat(5_000);
		const created = await writeReview(
			'POST',
			'/api/courses/WEBLAB/reviews',
			cookie,
			{ ...INPUT, text },
		);
		expect(created.status).toBe(201);
		const { review } = await created.json<{ review: { id: string } }>();
		const oversized = await writeReview(
			'PUT',
			`/api/reviews/${review.id}`,
			cookie,
			{
				...INPUT,
				text: '🧠'.repeat(9_000),
			},
		);
		expect(oversized.status).toBe(413);
		const listed = await worker.fetch(
			request('GET', '/api/courses/WEBLAB/reviews'),
			env,
		);
		expect(await listed.json()).toMatchObject({
			reviews: [{ id: review.id, text }],
		});
	});

	it('rejects unsupported methods with the methods supported by each resource', async () => {
		const collection = await worker.fetch(
			request('DELETE', '/api/courses/WEBLAB/reviews'),
			env,
		);
		expect(collection.status).toBe(405);
		expect(collection.headers.get('Allow')).toBe('GET, POST');
		const item = await worker.fetch(
			request('POST', '/api/reviews/missing'),
			env,
		);
		expect(item.status).toBe(405);
		expect(item.headers.get('Allow')).toBe('PUT, DELETE');
	});
});
