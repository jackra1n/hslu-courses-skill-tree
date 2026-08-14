import { env } from 'cloudflare:workers';
import { betterAuth } from 'better-auth';
import { createAuthOptions, type AuthSecrets } from './auth-options';

// Secrets are runtime bindings not visible to `wrangler types`; the cast
// documents the contract they must satisfy at deploy time.
export const auth = betterAuth(createAuthOptions(env.DB, env as Cloudflare.Env & AuthSecrets));
