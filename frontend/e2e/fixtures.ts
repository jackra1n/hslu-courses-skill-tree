import { Buffer } from 'node:buffer';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { test as base } from '@playwright/test';
import { betterAuth } from 'better-auth';
import { createTestHarness, type TestHarness } from 'wrangler';
import { createAuthOptions } from '../worker/auth-options';

export { expect } from '@playwright/test';

const secrets = {
	BETTER_AUTH_SECRET: Buffer.from(randomBytes(32)).toString('hex'),
	GITHUB_CLIENT_ID: 'e2e-unused',
	GITHUB_CLIENT_SECRET: 'e2e-unused',
};

type Backend = { url: URL; database: D1Database };
type Fixtures = {
	backend: Backend;
	login: (name?: string) => Promise<void>;
};

export const test = base.extend<Fixtures, { harness: TestHarness }>({
	harness: [
		// biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring to declare fixture dependencies.
		async ({}, use) => {
			const harness = createTestHarness({
				workers: [
					{ configPath: './e2e/wrangler.jsonc' },
					{
						configPath: './wrangler.jsonc',
						vars: { ENVIRONMENT: 'development' },
						secrets,
					},
				],
			});
			try {
				await harness.listen();
				await use(harness);
			} finally {
				await harness.close();
			}
		},
		{ scope: 'worker', timeout: 60_000 },
	],
	backend: async ({ harness }, use, testInfo) => {
		const api = harness.getWorker<Cloudflare.Env>('hslu-skill-tree-api');
		await api.applyD1Migrations('DB');
		const { DB } = await api.getEnv();
		const { url } = await harness.listen();
		try {
			await use({ url, database: DB });
		} finally {
			if (testInfo.status !== testInfo.expectedStatus) {
				await testInfo.attach('worker-logs', {
					body: JSON.stringify(harness.getLogs(), null, 2),
					contentType: 'application/json',
				});
			}
			await harness.reset();
		}
	},
	baseURL: async ({ backend }, use) => {
		await use(backend.url.origin);
	},
	login: async ({ backend, context }, use) => {
		// provision real users, sessions, and signed cookies, without automating
		// github or adding a test-only authentication route to the product.
		const auth = betterAuth(
			createAuthOptions(backend.database, {
				...secrets,
				ENVIRONMENT: 'development',
			}),
		);
		const authContext = await auth.$context;
		await use(async (name = 'E2E Reviewer') => {
			const user = await authContext.internalAdapter.createUser(
				{
					name,
					email: `${randomUUID()}@e2e.invalid`,
					emailVerified: true,
				},
				{ method: 'test' },
			);
			const session = await authContext.internalAdapter.createSession(user.id);
			const signature = createHmac('sha256', authContext.secret)
				.update(session.token)
				.digest('base64');
			await context.addCookies([
				{
					name: authContext.authCookies.sessionToken.name,
					value: encodeURIComponent(`${session.token}.${signature}`),
					domain: backend.url.hostname,
					path: '/api',
					httpOnly: true,
					secure: false,
					sameSite: 'Lax',
					expires: session.expiresAt.getTime() / 1000,
				},
			]);
		});
	},
});
