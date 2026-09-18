import { courses } from '../src/lib/data/catalog.generated.json';
import type {
	CourseReviewsResponse,
	Review,
	ReviewInput,
} from '../src/lib/data/review-types';
import { json, readBoundedBody } from './http';

const courseIds = new Set<string>();
for (const course of courses) courseIds.add(course.id);

const MAX_BODY_BYTES = 32_768;
const MAX_TEXT_LENGTH = 5_000;

function isRating(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isInteger(value) &&
		value >= 1 &&
		value <= 5
	);
}

async function readReviewBody(
	request: Request,
): Promise<ReviewInput | Response> {
	const raw = await readBoundedBody(request, MAX_BODY_BYTES);
	if (raw === null) return json({ error: 'payload too large' }, 413);
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return json({ error: 'invalid body' }, 400);
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return json({ error: 'invalid body' }, 400);
	}
	const {
		recommendation,
		contentInterest,
		difficulty,
		workload,
		text = '',
	} = parsed as Record<string, unknown>;
	if (
		!isRating(recommendation) ||
		!isRating(contentInterest) ||
		!isRating(difficulty) ||
		!isRating(workload) ||
		typeof text !== 'string' ||
		text.length > MAX_TEXT_LENGTH ||
		Object.keys(parsed).length !== (Object.hasOwn(parsed, 'text') ? 5 : 4)
	) {
		return json({ error: 'invalid body' }, 400);
	}
	return { recommendation, contentInterest, difficulty, workload, text };
}

// used by SELECT and write RETURNING clauses so responses share one shape.
// only the public display name is exposed, never email or session data.
const REVIEW_COLUMNS = `id, course_id AS courseId, user_id AS userId,
	(SELECT name FROM "user" WHERE "user".id = reviews.user_id) AS authorName,
	recommendation, content_interest AS contentInterest, difficulty, workload,
	text, created_at AS createdAt, updated_at AS updatedAt`;

export async function getCourseReviews(
	courseId: string,
	db: D1Database,
): Promise<Response> {
	if (!courseIds.has(courseId)) return json({ error: 'course not found' }, 404);
	const { results: reviews } = await db
		.prepare(
			`SELECT ${REVIEW_COLUMNS} FROM reviews
			WHERE course_id = ? ORDER BY created_at DESC, id DESC`,
		)
		.bind(courseId)
		.all<Review>();

	let recommendation = 0;
	let contentInterest = 0;
	let difficulty = 0;
	let workload = 0;
	for (const review of reviews) {
		recommendation += review.recommendation;
		contentInterest += review.contentInterest;
		difficulty += review.difficulty;
		workload += review.workload;
	}
	const count = reviews.length;
	return json(
		{
			reviews,
			summary: {
				count,
				recommendation: count ? recommendation / count : null,
				contentInterest: count ? contentInterest / count : null,
				difficulty: count ? difficulty / count : null,
				workload: count ? workload / count : null,
			},
		} satisfies CourseReviewsResponse,
		200,
	);
}

export async function createCourseReview(
	request: Request,
	courseId: string,
	userId: string,
	db: D1Database,
): Promise<Response> {
	if (!courseIds.has(courseId)) return json({ error: 'course not found' }, 404);
	const input = await readReviewBody(request);
	if (input instanceof Response) return input;
	const now = Date.now();
	const review = await db
		.prepare(
			`INSERT INTO reviews (
				id, course_id, user_id, recommendation, content_interest,
				difficulty, workload, text, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (course_id, user_id) DO NOTHING
			RETURNING ${REVIEW_COLUMNS}`,
		)
		.bind(
			crypto.randomUUID(),
			courseId,
			userId,
			input.recommendation,
			input.contentInterest,
			input.difficulty,
			input.workload,
			input.text,
			now,
			now,
		)
		.first<Review>();
	if (!review) return json({ error: 'review already exists' }, 409);
	return json({ review }, 201);
}

export async function updateReview(
	request: Request,
	reviewId: string,
	userId: string,
	db: D1Database,
): Promise<Response> {
	const input = await readReviewBody(request);
	if (input instanceof Response) return input;
	// ownership is checked in the write, not in a separate read that can race.
	const review = await db
		.prepare(
			`UPDATE reviews SET recommendation = ?, content_interest = ?,
				difficulty = ?, workload = ?, text = ?, updated_at = ?
			WHERE id = ? AND user_id = ?
			RETURNING ${REVIEW_COLUMNS}`,
		)
		.bind(
			input.recommendation,
			input.contentInterest,
			input.difficulty,
			input.workload,
			input.text,
			Date.now(),
			reviewId,
			userId,
		)
		.first<Review>();
	if (!review) return json({ error: 'review not found' }, 404);
	return json({ review }, 200);
}

export async function deleteReview(
	reviewId: string,
	userId: string,
	db: D1Database,
): Promise<Response> {
	const result = await db
		.prepare('DELETE FROM reviews WHERE id = ? AND user_id = ?')
		.bind(reviewId, userId)
		.run();
	if (result.meta.changes === 0)
		return json({ error: 'review not found' }, 404);
	return new Response(null, {
		status: 204,
		headers: { 'Cache-Control': 'no-store' },
	});
}
