import { fileURLToPath } from 'node:url';
import {
	cloudflareTest,
	readD1Migrations,
} from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

const migrationsDir = fileURLToPath(new URL('./migrations', import.meta.url));
const wranglerConfig = fileURLToPath(
	new URL('../wrangler.jsonc', import.meta.url),
);

export default defineConfig({
	test: {
		include: ['worker/test/**/*.test.ts'],
	},
	plugins: [
		cloudflareTest({
			wrangler: { configPath: wranglerConfig },
			miniflare: {
				bindings: {
					TEST_MIGRATIONS: await readD1Migrations(migrationsDir),
					BETTER_AUTH_SECRET: 'test-secret-0123456789abcdef0123456789abcdef',
					GITHUB_CLIENT_ID: 'test-client-id',
					GITHUB_CLIENT_SECRET: 'test-client-secret',
				},
			},
		}),
	],
});
