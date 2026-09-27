import { expect, test } from './fixtures';

const pages = [
	{
		path: '/',
		status: 'Loading course catalog…',
		ready: { role: 'button', name: 'Open progress analytics' },
	},
	{
		path: '/courses',
		status: 'Loading courses…',
		ready: { role: 'textbox', name: 'Search courses' },
	},
] as const;

for (const { path, status, ready } of pages) {
	test(`${path} keeps its layout while the catalog loads`, async ({ page }) => {
		await page.addInitScript(() => localStorage.setItem('hslu-skill-tree-tutorial-seen', 'true'));
		let release!: () => void;
		const released = new Promise<void>((resolve) => {
			release = resolve;
		});
		await page.route(/catalog\.generated\..*\.json$/, async (route) => {
			await released;
			await route.continue();
		});
		await page.goto(path);
		const control = page.getByRole(ready.role, { name: ready.name, exact: true });
		await expect(page.getByRole('status')).toHaveText(status);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await expect(control).toHaveCount(0);
		release();
		await expect(control).toBeVisible();
	});
}
