import { env } from 'cloudflare:workers';
import { type Auth, betterAuth } from 'better-auth';
import { type AuthSecrets, createAuthOptions } from './auth-options';

let auth: Auth | undefined;

// Schema validation performs database I/O, so initialize on first use within
// a request rather than while the Worker module is loading.
export function getAuth() {
	return (auth ??= betterAuth(
		createAuthOptions(env.DB, env as Cloudflare.Env & AuthSecrets),
	));
}
