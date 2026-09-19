import { expect, test } from './fixtures';

test('mobile recommendation follows a skipped tutorial and remembers dismissal', async ({
	page,
	isMobile,
}) => {
	test.skip(!isMobile, 'Mobile-only recommendation');
	await page.goto('/');
	const tutorial = page.locator('.driver-popover');
	const warning = page.locator('[data-mobile-warning]');
	await expect(tutorial).toBeVisible();
	await expect(warning).toHaveCount(0);
	await tutorial.locator('.driver-popover-close-btn').click();
	await expect(tutorial).toHaveCount(0);
	await expect(warning).toBeVisible();

	await page.reload();
	await expect(warning).toBeVisible();
	await expect(tutorial).toHaveCount(0);
	await warning
		.getByRole('button', { name: "Got it, don't show again" })
		.click();
	await page.reload();
	await expect(page.locator('.svelte-flow__node').first()).toBeVisible();
	await expect(warning).toHaveCount(0);
	await expect(tutorial).toHaveCount(0);
});

test('mobile recommendation waits through every tutorial step', async ({
	page,
	isMobile,
}) => {
	test.skip(!isMobile, 'Mobile-only recommendation');
	await page.goto('/');
	const tutorial = page.locator('.driver-popover');
	const warning = page.locator('[data-mobile-warning]');
	await expect(tutorial).toBeVisible();
	for (;;) {
		const advance = tutorial.getByRole('button', { name: /^(Next|Done)$/ });
		await expect(advance).toBeVisible();
		const finishing = (await advance.textContent()) === 'Done';
		await expect(warning).toHaveCount(0);
		await advance.click();
		if (finishing) break;
	}
	await expect(tutorial).toHaveCount(0);
	await expect(warning).toBeVisible();
});
