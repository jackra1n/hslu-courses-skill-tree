import { env } from 'cloudflare:workers';
import { getAuthTables } from 'better-auth/db';
import { describe, expect, it } from 'vitest';
import { createAuthOptions } from '../auth-options';
import { applyMigrations } from './apply-migrations';

function quoteIdentifier(identifier: string): string {
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
		throw new Error(`Unsafe database identifier: ${identifier}`);
	}
	return `"${identifier}"`;
}

describe('Better Auth database schema', () => {
	it('matches every column and unique index required by the installed version', async () => {
		await applyMigrations();
		const authTables = getAuthTables(
			createAuthOptions(env.DB, {
				BETTER_AUTH_SECRET: 'schema-contract-test-secret-0123456789abcdef',
				GITHUB_CLIENT_ID: 'test-client-id',
				GITHUB_CLIENT_SECRET: 'test-client-secret',
			}),
		);
		const missingColumns: string[] = [];
		const nullableRequiredColumns: string[] = [];
		const missingUniqueIndexes: string[] = [];

		for (const table of Object.values(authTables)) {
			const tableName = quoteIdentifier(table.modelName);
			const columnResult = await env.DB.prepare(
				`PRAGMA table_info(${tableName})`,
			).all<{ name: string; notnull: number; pk: number }>();
			const columns = new Map(
				columnResult.results.map((column) => [column.name, column]),
			);
			const physicalFieldName = (logicalName: string): string =>
				table.fields[logicalName]?.fieldName ?? logicalName;

			for (const [logicalName, field] of Object.entries(table.fields)) {
				const columnName = physicalFieldName(logicalName);
				const column = columns.get(columnName);
				if (!column) {
					missingColumns.push(`${table.modelName}.${columnName}`);
				} else if (field.required !== false && !column.notnull && !column.pk) {
					nullableRequiredColumns.push(`${table.modelName}.${columnName}`);
				}
			}

			const indexResult = await env.DB.prepare(
				`PRAGMA index_list(${tableName})`,
			).all<{ name: string; unique: number }>();
			const actualUniqueIndexes: string[] = [];
			for (const index of indexResult.results) {
				if (!index.unique) continue;
				const fields = await env.DB.prepare(
					`PRAGMA index_info(${quoteIdentifier(index.name)})`,
				).all<{ name: string; seqno: number }>();
				actualUniqueIndexes.push(
					fields.results
						.sort((left, right) => left.seqno - right.seqno)
						.map((field) => field.name)
						.join(','),
				);
			}

			const expectedUniqueIndexes = [
				...Object.entries(table.fields)
					.filter(([, field]) => field.unique)
					.map(([logicalName]) => physicalFieldName(logicalName)),
				...(table.indexes ?? [])
					.filter((index) => index.unique)
					.map((index) => index.fields.map(physicalFieldName).join(',')),
			];
			for (const expectedIndex of expectedUniqueIndexes) {
				if (!actualUniqueIndexes.includes(expectedIndex)) {
					missingUniqueIndexes.push(
						`${table.modelName}(${expectedIndex.replaceAll(',', ', ')})`,
					);
				}
			}
		}

		expect({
			missingColumns,
			nullableRequiredColumns,
			missingUniqueIndexes,
		}).toEqual({
			missingColumns: [],
			nullableRequiredColumns: [],
			missingUniqueIndexes: [],
		});
	});
});
