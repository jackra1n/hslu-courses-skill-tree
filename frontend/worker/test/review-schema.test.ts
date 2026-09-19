import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyMigrations, resetTestData, seedUser } from './apply-migrations';

function insertReview(
	id: string,
	userId: string,
	courseId: string,
	ratings: [number, number, number, number] = [4, 3, 2, 5],
) {
	return env.DB.prepare(
		`INSERT INTO reviews (
			id, user_id, course_id, recommendation, content_interest,
			difficulty, workload, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			id,
			userId,
			courseId,
			...ratings,
			1_800_000_000_000,
			1_800_000_000_000,
		)
		.run();
}

beforeEach(async () => {
	await applyMigrations();
	await resetTestData();
	await seedUser('reviewer-1');
	await seedUser('reviewer-2');
});

describe('course review constraints', () => {
	it('allows different authors and courses but rejects a second review for the same pair', async () => {
		await insertReview('first', 'reviewer-1', 'WEBLAB');
		await insertReview('other-author', 'reviewer-2', 'WEBLAB');
		await insertReview('other-course', 'reviewer-1', 'AINF');

		await expect(
			insertReview('duplicate', 'reviewer-1', 'WEBLAB'),
		).rejects.toThrow(/UNIQUE constraint failed/);

		const rows = await env.DB.prepare(
			'SELECT id FROM reviews ORDER BY id',
		).all();
		expect(rows.results).toEqual([
			{ id: 'first' },
			{ id: 'other-author' },
			{ id: 'other-course' },
		]);
	});

	it('accepts scale endpoints but rejects missing, fractional, and out-of-range ratings', async () => {
		await insertReview('low', 'reviewer-1', 'WEBLAB', [1, 1, 1, 1]);
		await insertReview('high', 'reviewer-2', 'WEBLAB', [5, 5, 5, 5]);

		for (const column of [
			'recommendation',
			'content_interest',
			'difficulty',
			'workload',
		]) {
			for (const value of [0, 6, 2.5, null]) {
				await expect(
					env.DB.prepare(`UPDATE reviews SET "${column}" = ? WHERE id = ?`)
						.bind(value, 'low')
						.run(),
				).rejects.toThrow(/(?:CHECK|NOT NULL) constraint failed/);
			}
		}

		const rows = await env.DB.prepare(
			'SELECT id, recommendation, content_interest, difficulty, workload FROM reviews ORDER BY id',
		).all();
		expect(rows.results).toEqual([
			{
				id: 'high',
				recommendation: 5,
				content_interest: 5,
				difficulty: 5,
				workload: 5,
			},
			{
				id: 'low',
				recommendation: 1,
				content_interest: 1,
				difficulty: 1,
				workload: 1,
			},
		]);
	});

	it('requires an existing author and removes only their reviews when their account is deleted', async () => {
		await expect(
			insertReview('orphan', 'missing-user', 'WEBLAB'),
		).rejects.toThrow(/FOREIGN KEY constraint failed/);

		await insertReview('first', 'reviewer-1', 'WEBLAB');
		await insertReview('other-course', 'reviewer-1', 'AINF');
		await insertReview('other-author', 'reviewer-2', 'WEBLAB');
		await env.DB.prepare('DELETE FROM "user" WHERE id = ?')
			.bind('reviewer-1')
			.run();

		const rows = await env.DB.prepare('SELECT id FROM reviews').all();
		expect(rows.results).toEqual([{ id: 'other-author' }]);
	});
});
