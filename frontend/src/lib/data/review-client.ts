import type {
	CourseReviewScore,
	CourseReviewsResponse,
	Review,
	ReviewInput,
} from './review-types';

export class ReviewApiError extends Error {
	constructor(public readonly status: number) {
		super(`Review request failed (${status})`);
	}
}

async function request(path: string, init: RequestInit): Promise<Response> {
	const response = await fetch(path, init);
	if (!response.ok) throw new ReviewApiError(response.status);
	return response;
}

export async function fetchCourseReviewScores(
	signal?: AbortSignal,
): Promise<CourseReviewScore[]> {
	const response = await request('/api/course-review-scores', { signal });
	const body: { scores: CourseReviewScore[] } = await response.json();
	return body.scores;
}

export async function fetchCourseReviews(
	courseId: string,
	signal?: AbortSignal,
): Promise<CourseReviewsResponse> {
	const response = await request(
		`/api/courses/${encodeURIComponent(courseId)}/reviews`,
		{ signal },
	);
	return response.json();
}

export async function saveCourseReview(
	courseId: string,
	reviewId: string | null,
	input: ReviewInput,
	signal: AbortSignal,
): Promise<Review> {
	const response = await request(
		reviewId
			? `/api/reviews/${encodeURIComponent(reviewId)}`
			: `/api/courses/${encodeURIComponent(courseId)}/reviews`,
		{
			method: reviewId ? 'PUT' : 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input),
			signal,
		},
	);
	const body: { review: Review } = await response.json();
	return body.review;
}

export async function deleteCourseReview(
	reviewId: string,
	signal: AbortSignal,
): Promise<void> {
	await request(`/api/reviews/${encodeURIComponent(reviewId)}`, {
		method: 'DELETE',
		signal,
	});
}
