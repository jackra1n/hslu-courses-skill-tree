// Minimal ambient declaration for the CLI-only bun:sqlite import. @types/bun
// is intentionally not installed; the CLI only needs the sqlite surface
// Better Auth's built-in adapter requires. auth.cli.ts is never bundled.
declare module 'bun:sqlite' {
	export class Database {
		constructor(path: string, options?: Record<string, unknown>);
		prepare(sql: string): unknown;
		exec(sql: string): unknown;
	}
}
