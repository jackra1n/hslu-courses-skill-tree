import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const conflictName = 'Choose which data to keep';

async function openSettings(page: Page) {
	await page
		.getByRole('button', { name: 'Settings & help', exact: true })
		.click();
	return page.getByRole('combobox', { name: 'Theme', exact: true });
}

async function closeSettings(page: Page) {
	await page
		.getByRole('button', { name: 'Close settings', exact: true })
		.click();
}

async function chooseDark(page: Page) {
	const theme = await openSettings(page);
	await theme.click();
	await page.getByRole('option', { name: 'Dark', exact: true }).click();
	await expect(theme).toHaveText('Dark');
	await closeSettings(page);
}

async function expectLocalDark(page: Page) {
	await expect(page.locator('html')).toHaveClass(/\bdark\b/);
	await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
	expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
	await expect(await openSettings(page)).toHaveText('Dark');
	await closeSettings(page);
}

async function expectSaved(page: Page) {
	await page.getByRole('button', { name: 'Account menu', exact: true }).click();
	await expect(page.getByText('Saved', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Account menu', exact: true }).click();
	await expect(page.getByRole('dialog', { name: conflictName })).toBeHidden();
}

async function snapshot(page: Page) {
	const response = await page.request.get('/api/progress');
	expect(response.ok()).toBe(true);
	return response.json();
}

async function addLegacyBaselineTheme(page: Page) {
	await page.evaluate(() => {
		const key = 'hslu-skill-tree-cloud-sync';
		const metadata = JSON.parse(localStorage.getItem(key)!);
		const baseline = JSON.parse(metadata.lastSyncedSnapshot);
		baseline.preferences.theme = 'system';
		metadata.lastSyncedSnapshot = JSON.stringify(baseline);
		metadata.dirty = true;
		localStorage.setItem(key, JSON.stringify(metadata));
	});
}

test('system appearance is the default until an explicit device choice survives reload and OS changes', async ({
	page,
}) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/courses');
	await expect(page.locator('html')).toHaveClass(/\bdark\b/);
	await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
	await expect(await openSettings(page)).toHaveText('System');
	expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull();

	await page.emulateMedia({ colorScheme: 'light' });
	await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
	await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
	await page.reload();
	await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
	await expect(await openSettings(page)).toHaveText('System');
	expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull();
	await closeSettings(page);

	await chooseDark(page);
	await page.reload();
	await expectLocalDark(page);
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.emulateMedia({ colorScheme: 'light' });
	await expectLocalDark(page);
});

test('signed-in theme changes stay local, and exports and imported progress never sync theme', async ({
	page,
	login,
}) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await login();
	await page.goto('/courses');
	await expectSaved(page);
	const original = await snapshot(page);
	expect(original.data.preferences).not.toHaveProperty('theme');
	let writes = 0;
	page.on('request', (request) => {
		if (
			new URL(request.url()).pathname === '/api/progress' &&
			request.method() === 'PUT'
		)
			writes++;
	});

	await chooseDark(page);
	// Observe past the sync debounce: a theme edit must not enqueue a save.
	await page.waitForTimeout(1_250);
	await expectSaved(page);
	expect(writes).toBe(0);
	expect((await snapshot(page)).revision).toBe(original.revision);

	await openSettings(page);
	const downloading = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export Data', exact: true }).click();
	const download = await downloading;
	const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
	expect(exported.preferences).not.toHaveProperty('theme');
	const [slot] = Object.keys(
		exported.studyPlans[exported.currentTemplateId].nodes,
	);
	const legacyBackup = {
		...exported,
		slotStatus: { [slot]: 'completed' },
		preferences: { ...exported.preferences, theme: 'light' },
	};
	const choosing = page.waitForEvent('filechooser');
	await page.getByRole('button', { name: 'Import Data', exact: true }).click();
	await (await choosing).setFiles({
		name: 'legacy-backup.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(legacyBackup)),
	});
	await expect(
		page.getByRole('button', { name: 'Close settings', exact: true }),
	).toBeHidden();
	await expect.poll(() => writes).toBe(1);
	await expectSaved(page);
	const imported = await snapshot(page);
	expect(imported.data.slotStatus).toEqual({ [slot]: 'completed' });
	expect(imported.data.preferences).not.toHaveProperty('theme');
	await expectLocalDark(page);
	await page.reload();
	await expectSaved(page);
	await expectLocalDark(page);
	expect(writes).toBe(1);
});

test('legacy cloud and baseline themes neither conflict nor replace the device theme when cloud progress is applied', async ({
	page,
	login,
}) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await login();
	await page.goto('/courses');
	await expectSaved(page);
	await chooseDark(page);
	const original = await snapshot(page);
	const legacyData = {
		...original.data,
		preferences: { ...original.data.preferences, theme: 'light' },
	};
	const headers = { Origin: new URL(page.url()).origin };
	const legacyResponse = await page.request.put('/api/progress', {
		headers,
		data: { data: legacyData, expectedRevision: original.revision },
	});
	expect(legacyResponse.ok()).toBe(true);
	const legacy = await legacyResponse.json();
	await addLegacyBaselineTheme(page);
	let writes = 0;
	page.on('request', (request) => {
		if (
			new URL(request.url()).pathname === '/api/progress' &&
			request.method() === 'PUT'
		)
			writes++;
	});
	await page.reload();
	await expectSaved(page);
	await expectLocalDark(page);
	expect((await snapshot(page)).revision).toBe(legacy.revision);

	const [first, second] = Object.keys(
		legacyData.studyPlans[legacyData.currentTemplateId].nodes,
	);
	const remoteOnly = await page.request.put('/api/progress', {
		headers,
		data: {
			data: { ...legacyData, slotStatus: { [first]: 'attended' } },
			expectedRevision: legacy.revision,
		},
	});
	expect(remoteOnly.ok()).toBe(true);
	const remote = await remoteOnly.json();
	// Keep the old baseline format to exercise normalization on the rebase path.
	await addLegacyBaselineTheme(page);
	await page.reload();
	await expectSaved(page);
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('slotStatus')!)),
	).toEqual({ [first]: 'attended' });
	await expectLocalDark(page);
	expect((await snapshot(page)).revision).toBe(remote.revision);
	expect(writes).toBe(0);

	const changed = await page.request.put('/api/progress', {
		headers,
		data: {
			data: { ...legacyData, slotStatus: { [first]: 'completed' } },
			expectedRevision: remote.revision,
		},
	});
	expect(changed.ok()).toBe(true);
	await page.evaluate((slot) => {
		localStorage.setItem('slotStatus', JSON.stringify({ [slot]: 'completed' }));
	}, second);
	await page.reload();
	const conflict = page.getByRole('dialog', { name: conflictName });
	await expect(conflict).toBeVisible();
	await expect(
		conflict.getByText('Individual course progress', { exact: true }),
	).toBeVisible();
	await expect(conflict.getByText('Theme', { exact: true })).toHaveCount(0);
	const writesBeforeChoice = writes;
	await conflict.getByRole('button', { name: 'Use cloud data' }).click();
	await expect(conflict).toBeHidden();
	await expectSaved(page);
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('slotStatus')!)),
	).toEqual({ [first]: 'completed' });
	await expectLocalDark(page);
	// Existing legacy payloads need not be rewritten until a real local save.
	expect((await snapshot(page)).revision).toBe(remote.revision + 1);
	expect(writes).toBe(writesBeforeChoice);
});
