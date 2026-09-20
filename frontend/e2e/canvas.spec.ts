import { expect, test } from './fixtures';

test('invalid badge preferences do not block startup or subsequent changes', async ({
	page,
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('hslu-skill-tree-tutorial-seen', 'true');
		if (localStorage.getItem('showCourseTypeBadges') === null) {
			localStorage.setItem('showCourseTypeBadges', '{broken');
		}
	});
	await page.goto('/');
	await expect(page.locator('.svelte-flow')).toBeVisible();
	await page.getByRole('button', { name: 'Study plan', exact: true }).click();
	const badges = page.locator('#show-course-badges');
	await expect(badges).toHaveAttribute('aria-pressed', 'false');
	await badges.click();
	await expect(badges).toHaveAttribute('aria-pressed', 'true');
	await page.reload();
	await page.getByRole('button', { name: 'Study plan', exact: true }).click();
	await expect(badges).toHaveAttribute('aria-pressed', 'true');
});

test('tutorial centers the course inside the canvas rather than the page', async ({
	page,
}) => {
	await page.goto('/');
	const tutorial = page.locator('.driver-popover');
	await tutorial
		.getByRole('button', { name: 'Start tour', exact: true })
		.click();
	await tutorial.getByRole('button', { name: 'Next', exact: true }).click();
	const course = page.locator(
		'.svelte-flow__node-custom.driver-active-element',
	);
	await expect(course).toBeVisible();
	await expect
		.poll(async () => {
			const node = await course.boundingBox();
			const canvas = await page.locator('.svelte-flow').boundingBox();
			if (!node || !canvas) return Infinity;
			return Math.max(
				Math.abs(node.x + node.width / 2 - canvas.x - canvas.width / 2),
				Math.abs(node.y + node.height / 2 - canvas.y - canvas.height / 2),
			);
		})
		.toBeLessThan(1);
});

test('closing course details also clears the canvas remove action', async ({
	page,
	isMobile,
}) => {
	await page.goto('/');
	// At the minimum zoom the first semester can be off-screen on mobile.
	// Use the tutorial's pan action before exercising the node.
	const tutorial = page.locator('.driver-popover');
	await tutorial
		.getByRole('button', { name: 'Start tour', exact: true })
		.click();
	await tutorial.getByRole('button', { name: 'Next', exact: true }).click();
	await expect(
		page.locator('.svelte-flow__node-custom.driver-active-element'),
	).toBeVisible();
	await tutorial.getByRole('button', { name: 'Close', exact: true }).click();
	const course = page.locator('.svelte-flow__node-custom').first();
	await course.click();
	const remove = course.getByRole('button', { name: /^Remove/ });
	await expect(remove).toHaveCount(1);
	await page
		.locator('#skill-tree-course-detail-panel')
		.getByRole('button', { name: 'Deselect course', exact: true })
		.click();
	await expect(remove).toHaveCount(0);
	await expect(course).not.toHaveClass(/\bselected\b/);
	if (!isMobile) {
		await course.click();
		const pane = page.locator('.svelte-flow__pane');
		await pane.click({ position: { x: 5, y: 5 } });
		await expect(remove).toHaveCount(0);
		await expect(
			page.locator('#skill-tree-course-detail-panel').getByRole('button', {
				name: 'Deselect course',
				exact: true,
			}),
		).toHaveCount(0);
	}
});

test('Backspace preserves the plan while the remove action persists deletion', async ({
	page,
	isMobile,
}) => {
	test.skip(
		isMobile,
		'Keyboard deletion and the inline remove action use the desktop canvas.',
	);
	await page.addInitScript(() =>
		localStorage.setItem('hslu-skill-tree-tutorial-seen', 'true'),
	);
	await page.goto('/');
	const first = page.locator('.svelte-flow__node-custom').first();
	await first.click();
	const id = await first.getAttribute('data-id');
	const course = page.locator(`.svelte-flow__node-custom[data-id="${id}"]`);
	await page.keyboard.press('Backspace');
	await expect(course).toBeVisible();
	await course.getByRole('button', { name: /^Remove/ }).click();
	await expect(course).toHaveCount(0);
	await expect(
		page.locator('#skill-tree-course-detail-panel').getByRole('button', {
			name: 'Deselect course',
			exact: true,
		}),
	).toHaveCount(0);
	await page.reload();
	await expect(page.locator('.svelte-flow__node-custom').first()).toBeVisible();
	await expect(course).toHaveCount(0);
});

test('replacing a completed elective does not transfer its progress', async ({
	page,
	isMobile,
}) => {
	test.skip(isMobile, 'Uses the desktop canvas add button.');
	await page.addInitScript(() =>
		localStorage.setItem('hslu-skill-tree-tutorial-seen', 'true'),
	);
	await page.goto('/');
	await page
		.getByRole('button', { name: 'Add course to semester 1', exact: true })
		.click();
	const node = page.locator('.svelte-flow__node-custom[data-id^="custom-"]');
	await node.click();
	const panel = page.locator('#skill-tree-course-detail-panel');
	const choose = panel.getByRole('button', {
		name: 'Choose a course for this slot',
		exact: true,
	});
	await choose.click();
	await page.getByRole('combobox').fill('Accounting Basics');
	await page
		.getByRole('option', {
			name: 'Accounting Basics (ACBA) — 3 ECTS',
			exact: true,
		})
		.click();
	await panel
		.getByRole('button', { name: 'Mark as Completed', exact: true })
		.click();
	await expect(
		panel.getByRole('button', { name: 'Completed', exact: true }),
	).toBeVisible();
	await choose.click();
	await page.getByRole('combobox').fill('Academic Methods');
	await page
		.getByRole('option', {
			name: 'Academic Methods (ACMET) — 3 ECTS',
			exact: true,
		})
		.click();
	await expect(
		panel.getByRole('button', { name: 'Completed', exact: true }),
	).toHaveCount(0);
	await expect(
		page.getByRole('button', { name: 'Open progress analytics' }),
	).toContainText('0 / 180');
	await page.reload();
	await node.click();
	await expect(
		panel.getByRole('button', { name: 'Completed', exact: true }),
	).toHaveCount(0);
});
