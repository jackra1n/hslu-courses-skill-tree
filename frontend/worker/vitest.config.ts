import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: '../wrangler.jsonc' },
			miniflare: {
				bindings: { TEST_MIGRATIONS: await readD1Migrations('./migrations') }
			}
		})
	]
});
