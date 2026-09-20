import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const conflictName = 'Choose which data to keep';

async function changeTheme(page: Page, name: 'Light' | 'Dark') {
	await page
		.getByRole('button', { name: 'Settings & help', exact: true })
		.click();
	await page.getByRole('combobox', { name: 'Theme', exact: true }).click();
	await page.getByRole('option', { name, exact: true }).click();
	await page
		.getByRole('button', { name: 'Close settings', exact: true })
		.click();
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

test.beforeEach(async ({ page, login, isMobile }) => {
	test.skip(
		isMobile,
		'Sync transitions run on desktop; the shared conflict dialog is also covered on mobile.',
	);
	await page.addInitScript(() => {
		localStorage.setItem('hslu-skill-tree-tutorial-seen', 'true');
		if (localStorage.getItem('theme') === null)
			localStorage.setItem('theme', 'system');
	});
	await login();
	await page.goto('/courses');
	await expect(
		page.getByRole('textbox', { name: 'Search courses' }),
	).toBeVisible();
	await expectSaved(page);
});

test('object key order alone neither conflicts nor uploads', async ({
	page,
}) => {
	const original = await snapshot(page);
	let writes = 0;
	await page.route('**/api/progress', async (route) => {
		if (route.request().method() === 'GET') {
			await route.fulfill({
				json: {
					...original,
					data: Object.fromEntries(Object.entries(original.data).reverse()),
				},
			});
		} else {
			writes++;
			await route.continue();
		}
	});
	await page.reload();
	await expect(
		page.getByRole('textbox', { name: 'Search courses' }),
	).toBeVisible();
	await expectSaved(page);
	expect(writes).toBe(0);
	expect((await snapshot(page)).revision).toBe(original.revision);
});

test('a local-only change survives navigation without a conflict', async ({
	page,
}) => {
	await changeTheme(page, 'Dark');
	await page.getByRole('link', { name: 'Skill Tree', exact: true }).click();
	await expect(page.locator('.svelte-flow')).toBeVisible();
	await expectSaved(page);
	expect((await snapshot(page)).data.preferences.theme).toBe('dark');
});

test('a cloud-only change is applied on reload without an echo write', async ({
	page,
}) => {
	const original = await snapshot(page);
	const updated = await page.request.put('/api/progress', {
		headers: { Origin: new URL(page.url()).origin },
		data: {
			data: {
				...original.data,
				preferences: { ...original.data.preferences, theme: 'dark' },
			},
			expectedRevision: original.revision,
		},
	});
	expect(updated.ok()).toBe(true);
	const remote = await updated.json();
	await page.reload();
	await expect(
		page.getByRole('textbox', { name: 'Search courses' }),
	).toBeVisible();
	await expectSaved(page);
	await expect(page.locator('html')).toHaveClass(/\bdark\b/);
	expect((await snapshot(page)).revision).toBe(remote.revision);
});

test('a stale revision with identical data is acknowledged without a conflict', async ({
	page,
}) => {
	let writes = 0;
	await page.route('**/api/progress', async (route) => {
		if (route.request().method() !== 'PUT') return route.continue();
		writes++;
		const response = await route.fetch();
		await route.fulfill({ status: 409, json: await response.json() });
	});
	await changeTheme(page, 'Dark');
	await expect.poll(() => writes).toBe(1);
	await expectSaved(page);
	expect((await snapshot(page)).data.preferences.theme).toBe('dark');
	expect(writes).toBe(1);
});

test('a failed older write retains the latest edit for reconnect', async ({
	page,
}) => {
	let release!: () => void;
	const blocked = new Promise<void>((resolve) => {
		release = resolve;
	});
	let writes = 0;
	await page.route('**/api/progress', async (route) => {
		if (route.request().method() !== 'PUT') return route.continue();
		writes++;
		if (writes === 1) {
			await blocked;
			await route.abort('internetdisconnected');
		} else {
			await route.continue();
		}
	});
	await changeTheme(page, 'Dark');
	await expect.poll(() => writes).toBe(1);
	await changeTheme(page, 'Light');
	release();
	await page.getByRole('button', { name: 'Account menu', exact: true }).click();
	await expect(
		page.getByText(
			'Cloud sync unavailable. Changes remain saved on this device.',
			{ exact: true },
		),
	).toBeVisible();
	await page.getByRole('button', { name: 'Account menu', exact: true }).click();
	await page.evaluate(() => window.dispatchEvent(new Event('online')));
	await expectSaved(page);
	expect((await snapshot(page)).data.preferences.theme).toBe('light');
});

test('unauthorized writes stop after one session revalidation', async ({
	page,
}) => {
	let writes = 0;
	await page.route('**/api/progress', async (route) => {
		if (route.request().method() !== 'PUT') return route.continue();
		writes++;
		await route.fulfill({ status: 401, json: { error: 'unauthorized' } });
	});
	await changeTheme(page, 'Dark');
	await page.getByRole('button', { name: 'Account menu', exact: true }).click();
	await expect(
		page.getByText(
			'Cloud sync unavailable. Changes remain saved on this device.',
			{ exact: true },
		),
	).toBeVisible();
	expect(writes).toBe(2);
});

test('conflict choices are locked while the selected version is saving', async ({
	page,
}) => {
	const original = await snapshot(page);
	const changed = await page.request.put('/api/progress', {
		headers: { Origin: new URL(page.url()).origin },
		data: {
			data: {
				...original.data,
				preferences: { ...original.data.preferences, theme: 'dark' },
			},
			expectedRevision: original.revision,
		},
	});
	expect(changed.ok()).toBe(true);
	await page.evaluate(() => localStorage.setItem('theme', 'light'));
	await page.reload();
	const conflict = page.getByRole('dialog', { name: conflictName });
	await expect(conflict).toBeVisible();
	await expect(
		conflict.getByText('Theme', { exact: true }).first(),
	).toBeVisible();
	let release!: () => void;
	const blocked = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route('**/api/progress', async (route) => {
		if (route.request().method() === 'PUT') await blocked;
		await route.continue();
	});
	const useLocal = conflict.getByRole('button', { name: 'Use this device' });
	const useCloud = conflict.getByRole('button', { name: 'Use cloud data' });
	await useLocal.click();
	await expect(useLocal).toBeDisabled();
	await expect(useCloud).toBeDisabled();
	release();
	await expect(conflict).toBeHidden();
	await expectSaved(page);
	expect((await snapshot(page)).data.preferences.theme).toBe('light');
});

test('another account never inherits the previous accounts sync baseline', async ({
	page,
	login,
}) => {
	const original = await snapshot(page);
	await login('Another account');
	const created = await page.request.put('/api/progress', {
		headers: { Origin: new URL(page.url()).origin },
		data: {
			data: {
				...original.data,
				preferences: { ...original.data.preferences, theme: 'dark' },
			},
			expectedRevision: null,
		},
	});
	expect(created.ok()).toBe(true);
	await page.reload();
	await expect(page.getByRole('dialog', { name: conflictName })).toBeVisible();
	const remote = await snapshot(page);
	expect(remote.revision).toBe(1);
	expect(remote.data.preferences.theme).toBe('dark');
});

test('equal completion counts do not hide different course progress', async ({
	page,
}) => {
	const original = await snapshot(page);
	const plan = original.data.studyPlans[original.data.currentTemplateId];
	const [first, second] = Object.keys(plan.nodes);
	const changed = await page.request.put('/api/progress', {
		headers: { Origin: new URL(page.url()).origin },
		data: {
			data: { ...original.data, slotStatus: { [first]: 'completed' } },
			expectedRevision: original.revision,
		},
	});
	expect(changed.ok()).toBe(true);
	await page.evaluate((slotId) => {
		localStorage.setItem(
			'slotStatus',
			JSON.stringify({ [slotId]: 'completed' }),
		);
	}, second);
	await page.reload();
	const conflict = page.getByRole('dialog', { name: conflictName });
	await expect(conflict).toBeVisible();
	await expect(
		conflict.getByText('Individual course progress', { exact: true }),
	).toBeVisible();
	await conflict.getByRole('button', { name: 'Use cloud data' }).click();
	await expect(conflict).toBeHidden();
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('slotStatus')!)),
	).toEqual({ [first]: 'completed' });
	expect((await snapshot(page)).revision).toBe(original.revision + 1);
});

test('an already uploaded snapshot does not conflict with a newer queued edit', async ({
	page,
}) => {
	let release!: () => void;
	const blocked = new Promise<void>((resolve) => {
		release = resolve;
	});
	let writes = 0;
	await page.route('**/api/progress', async (route) => {
		if (route.request().method() !== 'PUT') return route.continue();
		writes++;
		if (writes === 1) {
			const response = await route.fetch();
			const saved = await response.json();
			await blocked;
			await route.fulfill({ status: 409, json: saved });
		} else {
			await route.continue();
		}
	});
	await changeTheme(page, 'Dark');
	await expect.poll(() => writes).toBe(1);
	await changeTheme(page, 'Light');
	release();
	await expectSaved(page);
	expect((await snapshot(page)).data.preferences.theme).toBe('light');
	expect(writes).toBe(2);
});
