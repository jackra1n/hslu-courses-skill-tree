import { courses } from '../src/lib/data/catalog.generated.json';
import { json } from './http';

const courseIds = new Set<string>();
for (const course of courses) courseIds.add(course.id);

type Review = {
	id: string;
	courseId: string;
	userId: string;
	authorName: string;
	recommendation: number;
	contentInterest: number;
	difficulty: number;
	workload: number;
	text: string;
	createdAt: number;
	updatedAt: number;
};

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
		},
		200,
	);
}
