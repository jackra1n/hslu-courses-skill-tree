import { applyD1Migrations, env } from 'cloudflare:test';
import type { D1Migration } from '@cloudflare/vitest-pool-workers';
import { describe, expect, it } from 'vitest';
import { getAuth } from '../auth';

type TestEnv = Cloudflare.Env & { TEST_MIGRATIONS: D1Migration[] };

describe('Better Auth 1.7 account identity migration', () => {
	it('preserves legacy GitHub accounts and accepts new accounts after upgrading', async () => {
		const migrations = (env as TestEnv).TEST_MIGRATIONS;
		const identityMigrationIndex = migrations.findIndex((migration) =>
			migration.name.startsWith('0003_'),
		);
		expect(identityMigrationIndex).toBeGreaterThan(0);

		await applyD1Migrations(
			env.DB,
			migrations.slice(0, identityMigrationIndex),
		);

		const now = new Date().toISOString();
		await env.DB.prepare(
			'INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
		)
			.bind('user-1', 'Test User', 'test@example.com', 1, now, now)
			.run();
		await env.DB.prepare(
			'INSERT INTO account (id, accountId, providerId, userId, accessToken, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
		)
			.bind(
				'account-1',
				'github-user-1',
				'github',
				'user-1',
				'encrypted-token',
				now,
				now,
			)
			.run();

		await applyD1Migrations(env.DB, migrations.slice(identityMigrationIndex));

		const { internalAdapter } = await getAuth().$context;
		const account = await internalAdapter.findAccountByKey({
			providerId: 'github',
			accountId: 'github-user-1',
		});

		expect(account).toMatchObject({
			id: 'account-1',
			userId: 'user-1',
			providerId: 'github',
			accessToken: 'encrypted-token',
		});

		const created = await internalAdapter.createAccount({
			userId: 'user-1',
			providerId: 'github',
			accountId: 'github-user-2',
		});
		const saved = await internalAdapter.findAccountByKey({
			providerId: 'github',
			accountId: 'github-user-2',
		});
		expect(saved).toMatchObject({
			id: created.id,
			userId: 'user-1',
			providerId: 'github',
			accountId: 'github-user-2',
		});
	});
});
