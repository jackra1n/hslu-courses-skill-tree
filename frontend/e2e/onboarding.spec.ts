import { expect, test } from './fixtures';

const disclaimer = 'An independent student project, not supported by HSLU.';
const desktopTip =
	'For a clearer view of the full skill tree, try a larger screen.';

test('welcome combines context and lets visitors explore without more notices', async ({
	page,
	isMobile,
}) => {
	await page.goto('/');
	const welcome = page.locator('.driver-popover');
	await expect(welcome.getByText(disclaimer, { exact: true })).toBeVisible();
	if (isMobile) {
		await expect(welcome.getByText(desktopTip, { exact: true })).toBeVisible();
	} else {
		await expect(welcome.getByText(desktopTip, { exact: true })).toBeHidden();
	}
	await welcome
		.getByRole('button', { name: 'Explore on my own', exact: true })
		.click();
	await expect(welcome).toHaveCount(0);
	await expect(
		page.getByText(disclaimer, { exact: true }),
	).not.toBeInViewport();
	await expect(
		page.getByText(desktopTip, { exact: true }),
	).not.toBeInViewport();
	await page.reload();
	await expect(page.locator('.svelte-flow__node').first()).toBeVisible();
	await expect(welcome).toHaveCount(0);
	await expect(
		page.getByText(disclaimer, { exact: true }),
	).not.toBeInViewport();
});

test('starting and completing the tour does not open follow-up notices', async ({
	page,
}) => {
	await page.goto('/');
	const tutorial = page.locator('.driver-popover');
	await tutorial
		.getByRole('button', { name: 'Start tour', exact: true })
		.click();
	for (;;) {
		const advance = tutorial.getByRole('button', { name: /^(Next|Done)$/ });
		await expect(advance).toBeVisible();
		const finishing = (await advance.textContent()) === 'Done';
		await advance.click();
		if (finishing) break;
	}
	await expect(tutorial).toHaveCount(0);
	await expect(
		page.getByText(disclaimer, { exact: true }),
	).not.toBeInViewport();
	await expect(
		page.getByText(desktopTip, { exact: true }),
	).not.toBeInViewport();
});

test('existing visitors stay uninterrupted and can find context and replay in settings', async ({
	page,
	isMobile,
}) => {
	await page.addInitScript(() =>
		localStorage.setItem('hslu-skill-tree-tutorial-seen', 'true'),
	);
	await page.goto('/');
	await expect(page.locator('.svelte-flow__node').first()).toBeVisible();
	await expect(page.locator('.driver-popover')).toHaveCount(0);
	await expect(
		page.getByText(disclaimer, { exact: true }),
	).not.toBeInViewport();
	if (isMobile)
		await page.getByRole('button', { name: 'Menu', exact: true }).click();
	await page
		.getByRole('button', { name: 'Settings & help', exact: true })
		.click();
	await expect(page.getByText(disclaimer, { exact: true })).toBeVisible();
	await expect(page.getByText(desktopTip, { exact: true })).toBeVisible();
	await page
		.getByRole('button', { name: 'Start guided tutorial', exact: true })
		.click();
	await page.locator('.driver-popover-close-btn').click();
	await expect(page.locator('.driver-popover')).toHaveCount(0);
	await expect(
		page.getByText(disclaimer, { exact: true }),
	).not.toBeInViewport();
});
