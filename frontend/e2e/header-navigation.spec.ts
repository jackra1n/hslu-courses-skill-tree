import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() =>
		localStorage.setItem('hslu-skill-tree-tutorial-seen', 'true'),
	);
});

test('mobile navigation keeps progress available and closes nested controls cleanly', async ({
	page,
	isMobile,
}) => {
	test.skip(!isMobile, 'Mobile navigation');
	await page.goto('/');
	const menu = page.getByRole('button', { name: 'Menu', exact: true });
	const navigation = page.getByRole('navigation', {
		name: 'Menu',
		exact: true,
	});
	const progress = page.getByRole('button', {
		name: 'Open progress analytics',
	});
	await expect(progress).toBeVisible();
	await expect(navigation).toBeHidden();
	await page.getByRole('button', { name: 'Study plan', exact: true }).click();
	await expect(
		page.getByRole('combobox', { name: 'Program', exact: true }),
	).toBeVisible();
	await page
		.locator('header')
		.getByRole('button', { name: 'Close', exact: true })
		.click();
	await expect(
		page.getByRole('combobox', { name: 'Program', exact: true }),
	).toBeHidden();
	await menu.click();
	await expect(
		navigation.getByRole('link', { name: 'Course Browser' }),
	).toBeFocused();
	await navigation
		.getByRole('button', { name: 'Sign in', exact: true })
		.click();
	await expect(
		navigation.getByRole('button', { name: 'Continue with GitHub' }),
	).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(navigation).toBeHidden();
	await expect(menu).toBeFocused();
	await menu.click();
	await expect(
		navigation.getByRole('button', { name: 'Continue with GitHub' }),
	).toBeHidden();
	await progress.click();
	await expect(navigation).toBeHidden();
	await expect(
		page.getByRole('button', { name: 'Close progress', exact: true }),
	).toBeVisible();
	await page
		.getByRole('button', { name: 'Close progress', exact: true })
		.click();
	await menu.click();
	await navigation.getByRole('link', { name: 'Course Browser' }).click();
	await expect(page).toHaveURL(/\/courses$/);
	await expect(
		page.getByRole('textbox', { name: 'Search courses' }),
	).toBeVisible();
});

test('signed-in mobile account remains available inside navigation', async ({
	page,
	login,
	isMobile,
}) => {
	test.skip(!isMobile, 'Mobile navigation');
	await login();
	await page.goto('/');
	await page.getByRole('button', { name: 'Menu', exact: true }).click();
	const navigation = page.getByRole('navigation', {
		name: 'Menu',
		exact: true,
	});
	await navigation
		.getByRole('button', { name: 'Account menu', exact: true })
		.click();
	await expect(
		navigation.getByRole('button', { name: 'Sign out', exact: true }),
	).toBeVisible();
	await navigation
		.getByRole('button', { name: 'Sign out', exact: true })
		.click();
	await expect(
		navigation.getByRole('button', { name: 'Sign in', exact: true }),
	).toBeVisible();
});

test('mobile settings close directly and the collapsed legend hides its contents', async ({
	page,
	isMobile,
}) => {
	test.skip(!isMobile, 'Mobile panels');
	await page.goto('/');
	const menu = page.getByRole('button', { name: 'Menu', exact: true });
	await menu.click();
	await page
		.getByRole('button', { name: 'Settings & help', exact: true })
		.click();
	const closeSettings = page.getByRole('button', {
		name: 'Close settings',
		exact: true,
	});
	await expect(closeSettings).toBeVisible();
	await closeSettings.click();
	await expect(closeSettings).toBeHidden();
	await expect(menu).toBeFocused();
	await menu.click();
	await page
		.getByRole('button', { name: 'Settings & help', exact: true })
		.click();
	await page
		.locator('header')
		.getByRole('button', { name: 'Close', exact: true })
		.click();
	await expect(closeSettings).toBeHidden();
	await expect(menu).toHaveAttribute('aria-expanded', 'false');
	const legend = page.getByRole('button', {
		name: 'Toggle status legend',
		exact: true,
	});
	const content = page.locator('#mobile-status-legend');
	await expect(content).toBeHidden();
	await legend.click();
	await expect(content).toBeVisible();
	await legend.click();
	await expect(content).toBeHidden();
	await expect(legend).toHaveAttribute('aria-expanded', 'false');
});
