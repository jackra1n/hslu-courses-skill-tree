import { beforeEach, describe, expect, it } from 'vitest';
import worker from '../index';
import { applyMigrations } from './apply-migrations';

beforeEach(async () => {
	await applyMigrations();
});

// Regression guard for the local-dev contract: wrangler dev's origin host is
// pinned to localhost:5173 (dev.host) so the OAuth redirect_uri matches the
// development GitHub OAuth app callback instead of the production route host.
describe('auth redirect host resolution', () => {
	it('resolves localhost host for sign-in social', async () => {
		const res = await worker.fetch(
			new Request('http://localhost:5173/api/auth/sign-in/social', {
				method: 'POST',
				headers: {
					host: 'localhost:5173',
					'content-type': 'application/json',
					origin: 'http://localhost:5173'
				},
				body: JSON.stringify({ provider: 'github', callbackURL: 'http://localhost:5173' })
			}),
			{} as never
		);
		expect(res.status).not.toBe(500);
		const location = decodeURIComponent(res.headers.get('location') ?? '');
		expect(location).toContain('localhost:5173');
		expect(location).not.toContain('hsluskilltree.com');
	});
});
