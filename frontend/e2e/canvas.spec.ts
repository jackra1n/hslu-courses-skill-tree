import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import catalog from '../src/lib/data/catalog/catalog.generated.json' with {
	type: 'json',
};
import { expect, test } from './fixtures';

test('progress imports and saved statuses discard invalid entries without losing valid progress', async ({
	page,
	isMobile,
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('hslu-skill-tree-tutorial-seen', 'true');
		localStorage.setItem(
			'slotStatus',
			JSON.stringify({ valid: 'completed', invalid: 'bogus' }),
		);
	});
	await page.goto('/');
	await expect(page.locator('.svelte-flow')).toBeVisible();
	if (isMobile) {
		await page.getByRole('button', { name: 'Menu', exact: true }).click();
	}
	await page
		.getByRole('button', { name: 'Settings & help', exact: true })
		.click();
	const downloading = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export Data', exact: true }).click();
	const download = await downloading;
	const data = JSON.parse(await readFile(await download.path(), 'utf8'));
	expect(data.slotStatus).toEqual({ valid: 'completed' });

	data.slotStatus = { valid: 'attended', invalid: null };
	const choosing = page.waitForEvent('filechooser');
	await page.getByRole('button', { name: 'Import Data', exact: true }).click();
	await (await choosing).setFiles({
		name: 'progress.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(data)),
	});
	await expect(
		page.getByRole('button', { name: 'Close settings', exact: true }),
	).toBeHidden();
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('slotStatus')!)),
	).toEqual({ valid: 'attended' });
});

const STORAGE_FAILURES = [
	{ name: 'a later plan write', method: 'setItem', key: 'studyPlan:e2e-new' },
	{ name: 'a progress write', method: 'setItem', key: 'slotStatus' },
	{
		name: 'a stale plan removal',
		method: 'removeItem',
		key: 'studyPlan:e2e-stale',
	},
] as const;

for (const failure of STORAGE_FAILURES) {
	test(`imports roll back completely when ${failure.name} fails`, async ({
		page,
		isMobile,
	}) => {
		await page.addInitScript(() => {
			localStorage.setItem('hslu-skill-tree-tutorial-seen', 'true');
		});
		await page.goto('/');
		await expect(page.locator('.svelte-flow')).toBeVisible();
		if (isMobile) {
			await page.getByRole('button', { name: 'Menu', exact: true }).click();
		}
		await page
			.getByRole('button', { name: 'Settings & help', exact: true })
			.click();
		const exportData = async () => {
			const downloading = page.waitForEvent('download');
			await page
				.getByRole('button', { name: 'Export Data', exact: true })
				.click();
			return JSON.parse(
				await readFile(await (await downloading).path(), 'utf8'),
			);
		};
		const appStorage = () =>
			page.evaluate(() =>
				Object.keys(localStorage)
					.filter((key) => key !== 'hslu-skill-tree-cloud-sync')
					.sort()
					.map((key) => [key, localStorage.getItem(key)]),
			);

		const original = await exportData();
		const plan = original.studyPlans[original.currentTemplateId];
		await page.evaluate(
			(stale) => {
				localStorage.setItem('studyPlan:e2e-stale', JSON.stringify(stale));
			},
			{ ...plan, templateId: 'e2e-stale' },
		);
		const before = await appStorage();

		const nodeId = plan.rows[0].nodeOrder[0];
		const imported = {
			...original,
			studyPlans: {
				[original.currentTemplateId]: {
					...plan,
					nodes: {
						...plan.nodes,
						[nodeId]: { ...plan.nodes[nodeId], label: 'Imported' },
					},
				},
				'e2e-new': { ...plan, templateId: 'e2e-new' },
			},
			slotStatus: { [nodeId]: 'completed' },
		};
		await page.evaluate(({ method, key }) => {
			const original = Storage.prototype[method] as (
				this: Storage,
				...args: string[]
			) => void;
			Storage.prototype[method] = function (...args: string[]) {
				if (args[0] === key) {
					throw new DOMException('blocked', 'QuotaExceededError');
				}
				original.apply(this, args);
			};
		}, failure);
		const choosing = page.waitForEvent('filechooser');
		await page
			.getByRole('button', { name: 'Import Data', exact: true })
			.click();
		await (await choosing).setFiles({
			name: 'progress.json',
			mimeType: 'application/json',
			buffer: Buffer.from(JSON.stringify(imported)),
		});

		await expect(
			page.getByText('Your data could not be saved in this browser.', {
				exact: false,
			}),
		).toBeVisible();
		expect(await appStorage()).toEqual(before);
		const after = await exportData();
		expect(after.studyPlans[after.currentTemplateId]).toEqual(plan);
		expect(after.slotStatus).toEqual(original.slotStatus);
	});
}

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

test('Backspace preserves the plan while the remove action persists deletion', {
	tag: '@desktop-only',
}, async ({ page }) => {
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

test('replacing a completed elective does not transfer its progress', {
	tag: '@desktop-only',
}, async ({ page }) => {
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

async function loadRetakePlan(page: Page) {
	const template = catalog.templates[0];
	const courses = [
		{ id: 'custom-original', courseId: 'OOP', semester: 1 },
		{ id: 'custom-retake', courseId: 'OOP', semester: 2 },
		{ id: 'custom-passed', courseId: 'IOS', semester: 3 },
		{ id: 'custom-attended', courseId: 'AD', semester: 3 },
	];
	const plan = {
		templateId: template.id,
		planCode: template.plan,
		rows: [1, 2, 3].map((semester) => ({
			semester,
			nodeOrder: courses
				.filter((course) => course.semester === semester)
				.map((course) => course.id),
		})),
		nodes: Object.fromEntries(
			courses.map((course) => [
				course.id,
				{
					...course,
					kind: 'custom',
					slotType: 'custom',
					ects: catalog.courses.find((entry) => entry.id === course.courseId)!
						.ects,
					label: course.courseId,
				},
			]),
		),
	};
	await page.addInitScript((plan) => {
		localStorage.setItem('hslu-skill-tree-tutorial-seen', 'true');
		localStorage.setItem('currentTemplate', plan.templateId);
		localStorage.setItem('selectedPlan', plan.planCode);
		localStorage.setItem(`studyPlan:${plan.templateId}`, JSON.stringify(plan));
		localStorage.setItem(
			'slotStatus',
			JSON.stringify({
				'custom-original': 'attended',
				'custom-retake': 'completed',
			}),
		);
	}, plan);
	await page.goto('/');
}

test('prerequisite edges follow successful retakes and react to corrected outcomes', async ({
	page,
}) => {
	await loadRetakePlan(page);
	const edge = (source: string, target: string) =>
		page.locator(
			`.svelte-flow__edge[data-id="custom-${source}=>custom-${target}"]`,
		);
	await expect(edge('retake', 'passed')).toBeVisible();
	await expect(edge('original', 'passed')).toHaveCount(0);
	// An attendance-only prerequisite is already satisfied by the first attempt.
	await expect(edge('original', 'attended')).toBeVisible();

	await page
		.locator('.svelte-flow__node-custom[data-id="custom-original"]')
		.click();
	const panel = page.locator('#skill-tree-course-detail-panel');
	await panel
		.getByRole('button', { name: 'Mark as Completed', exact: true })
		.click();
	await expect(edge('original', 'passed')).toBeVisible();
	await expect(edge('retake', 'passed')).toHaveCount(0);

	await panel.getByRole('button', { name: 'Completed', exact: true }).click();
	await panel
		.getByRole('button', { name: 'Mark as Attended', exact: true })
		.click();
	await expect(edge('retake', 'passed')).toBeVisible();
	await expect(edge('original', 'passed')).toHaveCount(0);
	await expect(edge('original', 'attended')).toBeVisible();
});

test('graph animations and transitions follow live reduced-motion preferences', async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await loadRetakePlan(page);
	const node = page.locator(
		'.svelte-flow__node-custom[data-id="custom-original"]',
	);
	const paths = [
		page.locator(
			'.svelte-flow__edge[data-id="custom-retake=>custom-passed"] .svelte-flow__edge-path',
		),
		page.locator(
			'.svelte-flow__edge[data-id="custom-original=>custom-attended"] .svelte-flow__edge-path',
		),
	];
	await expect(node).toHaveCSS('transition-duration', '0s');
	for (const path of paths) {
		await expect(path).toHaveCSS('animation-name', 'none');
		await expect(path).toHaveCSS('transition-duration', '0s');
	}

	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await expect(node).not.toHaveCSS('transition-duration', '0s');
	for (const path of paths) {
		await expect(path).not.toHaveCSS('animation-name', 'none');
		await expect(path).not.toHaveCSS('transition-duration', '0s');
	}

	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect(node).toHaveCSS('transition-duration', '0s');
	for (const path of paths) {
		await expect(path).toHaveCSS('animation-name', 'none');
		await expect(path).toHaveCSS('transition-duration', '0s');
	}
});
