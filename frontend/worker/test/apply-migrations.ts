import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { D1Migration } from "@cloudflare/vitest-pool-workers";

type TestEnv = Cloudflare.Env & { TEST_MIGRATIONS: D1Migration[] };

// Applies every migration in worker/migrations to the test D1 database.
// D1 is isolated per test file by the vitest-pool-workers runtime.
export async function applyMigrations(): Promise<void> {
  await applyD1Migrations(env.DB, (env as TestEnv).TEST_MIGRATIONS);
}

// user_data.user_id references the Better Auth user table, so tests must seed
// a matching user row before writing progress snapshots.
export async function seedUser(userId: string): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(userId, `Test ${userId}`, `${userId}@test.example`, 1, now, now)
    .run();
}

// Storage is isolated per test FILE, not per test block, so each test must
// start from an empty user_data/user state.
export async function resetTestData(): Promise<void> {
  await env.DB.exec("DELETE FROM user_data");
  await env.DB.exec('DELETE FROM "user"');
}
