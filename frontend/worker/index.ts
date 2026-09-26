import { getAuth } from './auth';
import { APP_ORIGINS } from './auth-options';
import { json } from './http';
import { handleProgressRequest } from './progress';
import {
	createCourseReview,
	deleteReview,
	getCourseReviewScores,
	getCourseReviews,
	updateReview,
} from './reviews';

const ALLOWED_ORIGINS = new Set(APP_ORIGINS);

function isAllowedOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return origin !== null && ALLOWED_ORIGINS.has(origin);
}

async function getUserId(request: Request): Promise<string | null> {
	const session = await getAuth().api.getSession({ headers: request.headers });
	return session?.user.id ?? null;
}

// Structured error log: never request bodies, cookies, OAuth tokens, or AppData.
function logError(scope: string, request: Request, error: unknown): void {
	console.error(
		JSON.stringify({
			event: 'api-error',
			scope,
			method: request.method,
			path: new URL(request.url).pathname,
			error:
				error instanceof Error
					? { name: error.name, message: error.message }
					: 'unknown',
		}),
	);
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname.startsWith('/api/auth/')) {
			if (request.method === 'GET' || request.method === 'POST') {
				try {
					return await getAuth().handler(request);
				} catch (error) {
					logError('auth', request, error);
					return json({ error: 'internal' }, 500);
				}
			}
			return json({ error: 'method not allowed' }, 405, { Allow: 'GET, POST' });
		}

		if (url.pathname === '/api/progress') {
			if (request.method !== 'GET' && request.method !== 'PUT') {
				return json({ error: 'method not allowed' }, 405, {
					Allow: 'GET, PUT',
				});
			}
			if (request.method === 'PUT' && !isAllowedOrigin(request)) {
				return json({ error: 'forbidden origin' }, 403);
			}
			try {
				const userId = await getUserId(request);
				if (!userId) return json({ error: 'unauthorized' }, 401);
				return await handleProgressRequest(request, userId, env.DB);
			} catch (error) {
				logError('progress', request, error);
				return json({ error: 'internal' }, 500);
			}
		}

		if (url.pathname === '/api/course-review-scores') {
			if (request.method !== 'GET') {
				return json({ error: 'method not allowed' }, 405, { Allow: 'GET' });
			}
			try {
				return await getCourseReviewScores(env.DB);
			} catch (error) {
				logError('reviews', request, error);
				return json({ error: 'internal' }, 500);
			}
		}

		const courseReviews = /^\/api\/courses\/([^/]+)\/reviews$/.exec(
			url.pathname,
		);
		const review = /^\/api\/reviews\/([^/]+)$/.exec(url.pathname);
		const reviewRoute = courseReviews ?? review;
		if (reviewRoute) {
			const allowed = courseReviews
				? request.method === 'GET' || request.method === 'POST'
				: request.method === 'PUT' || request.method === 'DELETE';
			if (!allowed) {
				return json({ error: 'method not allowed' }, 405, {
					Allow: courseReviews ? 'GET, POST' : 'PUT, DELETE',
				});
			}
			let id: string;
			try {
				id = decodeURIComponent(reviewRoute[1]);
			} catch {
				return json({ error: 'invalid id' }, 400);
			}
			try {
				if (request.method === 'GET') {
					return await getCourseReviews(id, await getUserId(request), env.DB);
				}
				if (!isAllowedOrigin(request)) {
					return json({ error: 'forbidden origin' }, 403);
				}
				const userId = await getUserId(request);
				if (!userId) return json({ error: 'unauthorized' }, 401);
				if (courseReviews) {
					return await createCourseReview(request, id, userId, env.DB);
				}
				if (request.method === 'PUT') {
					return await updateReview(request, id, userId, env.DB);
				}
				return await deleteReview(id, userId, env.DB);
			} catch (error) {
				logError('reviews', request, error);
				return json({ error: 'internal' }, 500);
			}
		}

		return json({ error: 'not found' }, 404);
	},
} satisfies ExportedHandler<Env>;
