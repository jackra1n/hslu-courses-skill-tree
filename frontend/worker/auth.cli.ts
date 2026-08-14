import { Database } from 'bun:sqlite';
import { betterAuth } from 'better-auth';
import { createAuthOptions } from './auth-options';

// CLI-only entry for `auth generate` / future schema upgrades. Bun's in-memory
// SQLite satisfies Better Auth's built-in adapter without any Cloudflare
// binding. Never import this file from the Worker bundle.

// CLI-only entry for `auth generate` / future schema upgrades. Bun's in-memory
// SQLite satisfies Better Auth's built-in adapter without any Cloudflare
// binding. Never import this file from the Worker bundle.
const sqlite = new Database(':memory:');

export const auth = betterAuth(
	createAuthOptions(sqlite, {
		BETTER_AUTH_SECRET: 'schema-generation-only-not-a-runtime-secret-2026',
		GITHUB_CLIENT_ID: 'schema-only',
		GITHUB_CLIENT_SECRET: 'schema-only'
	})
);
