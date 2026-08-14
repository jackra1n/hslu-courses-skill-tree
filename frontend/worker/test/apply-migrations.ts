import { applyD1Migrations, env } from 'cloudflare:test';

// Applies every migration in worker/migrations to the test D1 database.
// D1 is isolated per test file by the vitest-pool-workers runtime.
export async function applyMigrations(): Promise<void> {
	await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
}
