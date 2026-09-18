import { auth } from './auth';
import { json } from './http';
import { handleProgressRequest } from './progress';
import {
	createCourseReview,
	deleteReview,
	getCourseReviews,
	updateReview,
} from './reviews';

const ALLOWED_ORIGINS = new Set([
	'https://hsluskilltree.com',
	'http://localhost:5173',
	'http://127.0.0.1:5173',
]);

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
					return await auth.handler(request);
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
			if (request.method === 'PUT') {
				const origin = request.headers.get('Origin');
				if (!origin || !ALLOWED_ORIGINS.has(origin)) {
					return json({ error: 'forbidden origin' }, 403);
				}
			}
			try {
				const session = await auth.api.getSession({ headers: request.headers });
				if (!session) return json({ error: 'unauthorized' }, 401);
				return await handleProgressRequest(request, session.user.id, env.DB);
			} catch (error) {
				logError('progress', request, error);
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
					return await getCourseReviews(id, env.DB);
				}
				const origin = request.headers.get('Origin');
				if (!origin || !ALLOWED_ORIGINS.has(origin)) {
					return json({ error: 'forbidden origin' }, 403);
				}
				const session = await auth.api.getSession({ headers: request.headers });
				if (!session) return json({ error: 'unauthorized' }, 401);
				if (courseReviews) {
					return await createCourseReview(request, id, session.user.id, env.DB);
				}
				if (request.method === 'PUT') {
					return await updateReview(request, id, session.user.id, env.DB);
				}
				return await deleteReview(id, session.user.id, env.DB);
			} catch (error) {
				logError('reviews', request, error);
				return json({ error: 'internal' }, 500);
			}
		}

		return json({ error: 'not found' }, 404);
	},
} satisfies ExportedHandler<Env>;
