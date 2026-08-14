import type { BetterAuthOptions } from "better-auth";

export type AuthSecrets = {
  BETTER_AUTH_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ENVIRONMENT?: string;
};

// D1Database is the global runtime binding type from worker/env.d.ts. The
// structural fallback covers Bun's sqlite Database used by the CLI entry.
export type AuthDatabase =
  D1Database | { prepare(sql: string): unknown; exec(sql: string): unknown };

// One options object shared by the runtime Worker and the schema-generation
// CLI so both stay on the same Better Auth configuration.
export function createAuthOptions(
  database: AuthDatabase,
  secrets: AuthSecrets,
): BetterAuthOptions {
  return {
    database,
    secret: secrets.BETTER_AUTH_SECRET,
    baseURL: {
      // Dynamic per-request base URL limited to the app's real hosts. No
      // fallback: unknown hosts throw instead of being silently trusted.
      allowedHosts: ["hsluskilltree.com", "localhost:5173", "127.0.0.1:5173"],
    },
    trustedOrigins: [
      "https://hsluskilltree.com",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
    socialProviders: {
      github: {
        clientId: secrets.GITHUB_CLIENT_ID,
        clientSecret: secrets.GITHUB_CLIENT_SECRET,
        scope: ["user:email"],
      },
    },
    account: {
      encryptOAuthTokens: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // 24 hours
    },
    advanced: {
      cookiePrefix: "hslu-skill-tree",
      // Workers has no NODE_ENV, so production detection is explicit. The
      // ENVIRONMENT var is fixed in wrangler.jsonc; Secure cookies keep the
      // GitHub Pages origin from ever reading auth cookies.
      useSecureCookies: secrets.ENVIRONMENT === "production",
      defaultCookieAttributes: {
        path: "/api",
      },
    },
  };
}
