import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

function courseRow(page: Page, moduleId: string) {
	return page.getByRole('button', {
		name: new RegExp(`\\b${moduleId} ·`),
	});
}

async function expandFilters(page: Page, isMobile: boolean) {
	if (!isMobile) return;
	const toggle = page.getByRole('button', { name: /^Filters/ });
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(page.getByRole('combobox', { name: 'Semester' })).toBeHidden();
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(page.getByRole('combobox', { name: 'Semester' })).toBeVisible();
}

async function collapseFilters(page: Page, isMobile: boolean) {
	if (!isMobile) return;
	const toggle = page.getByRole('button', { name: /^Filters/ });
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(page.getByRole('combobox', { name: 'Semester' })).toBeHidden();
}

async function seedReview(
	page: Page,
	origin: string,
	courseId: string,
	recommendation: number,
) {
	const response = await page.request.post(`/api/courses/${courseId}/reviews`, {
		headers: { Origin: origin },
		data: {
			recommendation,
			contentInterest: 6 - recommendation,
			difficulty: 6 - recommendation,
			workload: 3,
			text: '',
		},
	});
	expect(response.status()).toBe(201);
}

async function expectCourseOrder(page: Page, courseIds: string[]) {
	await expect(page.getByRole('list').getByRole('button')).toContainText(
		courseIds.map((id) => new RegExp(`\\b${id}\\b`)),
	);
	await expect(page.getByRole('list').getByRole('button')).toHaveCount(
		courseIds.length,
	);
}

test('sorts courses by name or average recommendation, retaining order through search and filters', async ({
	page,
	login,
	backend,
	context,
	isMobile,
}) => {
	await login('First reviewer');
	await seedReview(page, backend.url.origin, 'CPLAB', 1);
	await seedReview(page, backend.url.origin, 'ENLAB_MM', 4);
	await seedReview(page, backend.url.origin, 'WEBLAB', 3);
	await login('Second reviewer');
	await seedReview(page, backend.url.origin, 'CPLAB', 5);
	// browse anonymously: both reviewers must contribute to Cloud's mean of
	// three, not its sum of six, latest score of five, or inverse dimensions.
	await context.clearCookies();
	await page.goto('/courses');
	const search = page.getByRole('textbox', { name: 'Search courses' });
	await search.fill('Programming Lab');
	const sort = page.getByRole('combobox', { name: 'Sort by', exact: true });
	await expect(sort).toHaveText('Course name: A–Z');
	await expectCourseOrder(page, [
		'CPLAB',
		'ENLAB_MM',
		'MOBLAB',
		'PLAB',
		'WEBLAB',
	]);
	await sort.click();
	await page
		.getByRole('option', { name: 'Course name: Z–A', exact: true })
		.click();
	await expectCourseOrder(page, [
		'WEBLAB',
		'PLAB',
		'MOBLAB',
		'ENLAB_MM',
		'CPLAB',
	]);
	await sort.click();
	await page
		.getByRole('option', { name: 'Review score: highest first', exact: true })
		.click();
	await expectCourseOrder(page, [
		'ENLAB_MM',
		'CPLAB',
		'WEBLAB',
		'MOBLAB',
		'PLAB',
	]);
	await sort.click();
	await page
		.getByRole('option', { name: 'Review score: lowest first', exact: true })
		.click();
	// cloud and Web tie alphabetically; the two unrated courses follow every
	// rated course in alphabetical order in both score directions.
	await expectCourseOrder(page, [
		'CPLAB',
		'WEBLAB',
		'ENLAB_MM',
		'MOBLAB',
		'PLAB',
	]);
	await expandFilters(page, isMobile);
	await page
		.getByRole('checkbox', { name: 'Major/Minor module', exact: true })
		.check();
	await page.getByRole('combobox', { name: 'Semester' }).click();
	await page.getByRole('option', { name: 'Autumn (HS)', exact: true }).click();
	await collapseFilters(page, isMobile);
	await expectCourseOrder(page, ['CPLAB', 'WEBLAB', 'MOBLAB']);
	await search.fill('Web Programming Lab');
	await expectCourseOrder(page, ['WEBLAB']);
	await search.fill('Programming Lab');
	await expectCourseOrder(page, ['CPLAB', 'WEBLAB', 'MOBLAB']);
	await expect(sort).toHaveText('Review score: lowest first');
});

test('editing and deleting your review reorders courses without reloading the browser', async ({
	page,
	login,
	backend,
}) => {
	await login();
	await seedReview(page, backend.url.origin, 'CPLAB', 3);
	await seedReview(page, backend.url.origin, 'WEBLAB', 1);
	await page.goto('/courses');
	await page
		.getByRole('textbox', { name: 'Search courses' })
		.fill('Programming Lab');
	const sort = page.getByRole('combobox', { name: 'Sort by', exact: true });
	await sort.click();
	await page
		.getByRole('option', { name: 'Review score: highest first', exact: true })
		.click();
	await expectCourseOrder(page, [
		'CPLAB',
		'WEBLAB',
		'ENLAB_MM',
		'MOBLAB',
		'PLAB',
	]);
	await courseRow(page, 'WEBLAB').click();
	const panel = page.locator('#course-detail-panel');
	await panel.getByRole('tab', { name: 'Reviews', exact: true }).click();
	await panel.getByRole('button', { name: 'Edit review', exact: true }).click();
	const form = panel.getByRole('form', { name: 'Edit review', exact: true });
	await form
		.getByRole('group', { name: 'Recommendation', exact: true })
		.getByRole('radio', { name: /^5(?:\D|$)/ })
		.press('Space');
	// Closing the panel must not discard the summary of a persisted write.
	const savedRefresh = Promise.withResolvers<void>();
	await page.route(
		'**/api/courses/WEBLAB/reviews',
		async (route) => {
			await savedRefresh.promise;
			await route.continue();
		},
		{ times: 1 },
	);
	await form.getByRole('button', { name: 'Save changes', exact: true }).click();
	await expect(form).toBeHidden();
	await panel
		.getByRole('button', { name: 'Close course details', exact: true })
		.click();
	await expect(
		panel.getByRole('tab', { name: 'Reviews', exact: true }),
	).toBeHidden();
	savedRefresh.resolve();
	await expectCourseOrder(page, [
		'WEBLAB',
		'CPLAB',
		'ENLAB_MM',
		'MOBLAB',
		'PLAB',
	]);
	await courseRow(page, 'WEBLAB').click();
	await panel.getByRole('tab', { name: 'Reviews', exact: true }).click();
	await panel
		.getByRole('button', { name: 'Delete review', exact: true })
		.click();
	const confirmation = page.getByRole('dialog', {
		name: 'Delete your review?',
		exact: true,
	});
	const deletedRefresh = Promise.withResolvers<void>();
	await page.route(
		'**/api/courses/WEBLAB/reviews',
		async (route) => {
			await deletedRefresh.promise;
			await route.continue();
		},
		{ times: 1 },
	);
	const deletionRefreshing = page.waitForRequest(
		(request) =>
			request.method() === 'GET' &&
			request.url().endsWith('/api/courses/WEBLAB/reviews'),
	);
	await confirmation
		.getByRole('button', { name: 'Delete review', exact: true })
		.click();
	await expect(confirmation).toBeHidden();
	await deletionRefreshing;
	await panel
		.getByRole('button', { name: 'Close course details', exact: true })
		.click();
	await expect(
		panel.getByRole('tab', { name: 'Reviews', exact: true }),
	).toBeHidden();
	deletedRefresh.resolve();
	await expectCourseOrder(page, [
		'CPLAB',
		'ENLAB_MM',
		'MOBLAB',
		'PLAB',
		'WEBLAB',
	]);
	await expect(sort).toHaveText('Review score: highest first');
});

test('combines search, module type, assessment and semester, then recovers from empty results', async ({
	page,
	isMobile,
}) => {
	await page.goto('/courses');
	const search = page.getByRole('textbox', { name: 'Search courses' });
	await search.fill('  PrOgRaMmInG  ');
	// these are independently chosen catalog examples, not results calculated
	// with the application's filter implementation.
	await expect(courseRow(page, 'WEBLAB')).toBeVisible();
	await expect(courseRow(page, 'ENLAB_MM')).toBeVisible();
	await expect(courseRow(page, 'OOP')).toBeVisible();
	await expect(courseRow(page, 'DBS')).toHaveCount(0);

	await expandFilters(page, isMobile);
	const major = page.getByRole('checkbox', {
		name: 'Major/Minor module',
		exact: true,
	});
	await major.check();
	await expect(courseRow(page, 'OOP')).toHaveCount(0);
	await expect(courseRow(page, 'WEBLAB')).toBeVisible();
	await expect(courseRow(page, 'CPLAB')).toBeVisible();

	const oral = page.getByRole('checkbox', { name: 'Oral exam', exact: true });
	await oral.check();
	await expect(courseRow(page, 'CPLAB')).toHaveCount(0);
	await expect(courseRow(page, 'WEBLAB')).toBeVisible();
	await expect(courseRow(page, 'ENLAB_MM')).toBeVisible();

	const semester = page.getByRole('combobox', { name: 'Semester' });
	await semester.click();
	await page.getByRole('option', { name: 'Autumn (HS)', exact: true }).click();
	await expect(courseRow(page, 'ENLAB_MM')).toHaveCount(0);
	await expect(courseRow(page, 'WEBLAB')).toBeVisible();
	await collapseFilters(page, isMobile);

	await search.fill('no-such-course-e2e');
	await expect(
		page.getByText('No courses found', { exact: true }),
	).toBeVisible();
	await expect(page.getByRole('list').getByRole('button')).toHaveCount(0);
	// clearing the search must not clear the independently selected filters.
	await page
		.getByRole('search')
		.getByRole('button', { name: 'Clear', exact: true })
		.click();
	await expect(search).toHaveValue('');
	await expect(
		page.getByText('No courses found', { exact: true }),
	).toBeHidden();
	await expect(courseRow(page, 'WEBLAB')).toBeVisible();
	await expect(courseRow(page, 'ENLAB_MM')).toHaveCount(0);
	await expect(courseRow(page, 'OOP')).toHaveCount(0);
	await expect(courseRow(page, 'CPLAB')).toHaveCount(0);

	// with the query empty and results present, the remaining Clear action
	// resets the whole filter set rather than just the search field.
	await page.getByRole('button', { name: 'Clear', exact: true }).click();
	await expect(courseRow(page, 'ENLAB_MM')).toBeVisible();
	await expect(courseRow(page, 'OOP')).toBeVisible();
	await expect(courseRow(page, 'CPLAB')).toBeVisible();
	await expect(courseRow(page, 'DBS')).toBeVisible();
	await expandFilters(page, isMobile);
	await expect(major).not.toBeChecked();
	await expect(oral).not.toBeChecked();
	await expect(semester).toHaveText('All semesters');
});

test('facet counts ignore their own selection and reset restores every filter', async ({
	page,
	isMobile,
}) => {
	await page.goto('/courses');
	await expandFilters(page, isMobile);
	const reset = page.getByRole('button', { name: 'Reset all', exact: true });
	await expect(reset).toBeDisabled();
	const search = page.getByRole('textbox', { name: 'Search courses' });
	await search.fill('ENLAB_MM');
	const major = page.getByRole('checkbox', {
		name: 'Major/Minor module',
		exact: true,
	});
	const core = page.getByRole('checkbox', { name: 'Core module', exact: true });
	const oral = page.getByRole('checkbox', { name: 'Oral exam', exact: true });
	await expect(major).toHaveAccessibleDescription('1');
	await core.check();
	// the alternative type remains discoverable, but assessment counts
	// respect the selected module type.
	await expect(major).toHaveAccessibleDescription('1');
	await expect(oral).toHaveAccessibleDescription('0');
	await major.check();
	await expect(oral).toHaveAccessibleDescription('1');
	await oral.check();
	await expect(major).toHaveAccessibleDescription('1');
	const next = page.getByRole('switch', {
		name: 'Only courses I can take next',
	});
	await next.check();
	await expect(major).toHaveAccessibleDescription('0');
	await reset.click();
	await expect(search).toHaveValue('');
	await expect(core).not.toBeChecked();
	await expect(major).not.toBeChecked();
	await expect(oral).not.toBeChecked();
	await expect(next).not.toBeChecked();
	await expect(reset).toBeDisabled();
	await expect(courseRow(page, 'ENLAB_MM')).toBeVisible();
});

test('follows a prerequisite outside the result set without losing filters or return focus', async ({
	page,
	isMobile,
}) => {
	await page.goto('/courses');
	const search = page.getByRole('textbox', { name: 'Search courses' });
	await search.fill('ENLAB_MM');
	await expandFilters(page, isMobile);
	const semester = page.getByRole('combobox', { name: 'Semester' });
	await semester.click();
	await page.getByRole('option', { name: 'Spring (FS)', exact: true }).click();
	const major = page.getByRole('checkbox', {
		name: 'Major/Minor module',
		exact: true,
	});
	await major.check();
	await collapseFilters(page, isMobile);

	const origin = courseRow(page, 'ENLAB_MM');
	await expect(origin).toBeVisible();
	await expect(courseRow(page, 'DBS')).toHaveCount(0);
	await origin.click();
	const panelRole = isMobile ? 'dialog' : 'region';
	const enterprise = page.getByRole(panelRole, {
		name: 'Enterprise Programming Lab',
		exact: true,
	});
	await expect(enterprise).toBeVisible();
	const closeEnterprise = enterprise.getByRole('button', {
		name: 'Close course details',
		exact: true,
	});
	if (isMobile) {
		await expect(enterprise).toHaveAttribute('aria-modal', 'true');
		await expect(closeEnterprise).toBeFocused();
		// backward tabbing from the first control stays inside the modal;
		// tabbing forward again wraps back to its close action.
		await closeEnterprise.press('Shift+Tab');
		await expect(enterprise.locator(':focus')).toHaveCount(1);
		await page.keyboard.press('Tab');
		await expect(closeEnterprise).toBeFocused();
	}

	await enterprise
		.getByRole('tab', { name: 'Prerequisites', exact: true })
		.click();
	await enterprise
		.getByRole('button', {
			name: /Database Systems/,
		})
		.click();
	const database = page.getByRole(panelRole, {
		name: 'Database Systems',
		exact: true,
	});
	await expect(database).toBeVisible();
	await expect(database.getByText('DBS', { exact: true })).toBeVisible();
	await expect(
		database.getByRole('heading', { name: 'Database Systems', exact: true }),
	).toBeVisible();
	await expect(
		database.getByRole('button', { name: 'Close course details', exact: true }),
	).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(database).toBeHidden();
	await expect(origin).toBeFocused();
	await expect(search).toHaveValue('ENLAB_MM');
	await expect(courseRow(page, 'DBS')).toHaveCount(0);

	await expandFilters(page, isMobile);
	await expect(semester).toHaveText('Spring (FS)');
	await expect(major).toBeChecked();
	await collapseFilters(page, isMobile);
	await origin.click();
	await expect(enterprise).toBeVisible();
	await closeEnterprise.click();
	await expect(enterprise).toBeHidden();
	await expect(origin).toBeFocused();
});

test('semester dropdown commits keyboard selection but Escape leaves the current filter intact', async ({
	page,
	isMobile,
}) => {
	await page.goto('/courses');
	await page
		.getByRole('textbox', { name: 'Search courses' })
		.fill('programming');
	await expandFilters(page, isMobile);
	const semester = page.getByRole('combobox', { name: 'Semester' });
	const options = page.getByRole('listbox', { name: 'Semester' });

	await semester.focus();
	await semester.press('End');
	await expect(options).toBeVisible();
	await semester.press('Enter');
	await expect(options).toBeHidden();
	await expect(semester).toHaveText('Spring (FS)');
	await expect(semester).toBeFocused();
	await expect(courseRow(page, 'ENLAB_MM')).toBeVisible();
	await expect(courseRow(page, 'MOBLAB')).toHaveCount(0);

	await semester.press('ArrowUp');
	await expect(
		options.getByRole('option', { name: 'Spring (FS)', exact: true }),
	).toHaveAttribute('aria-selected', 'true');
	await semester.press('ArrowUp');
	await semester.press('Escape');
	await expect(options).toBeHidden();
	await expect(semester).toBeFocused();
	await expect(semester).toHaveText('Spring (FS)');
	await expect(courseRow(page, 'ENLAB_MM')).toBeVisible();
	await expect(courseRow(page, 'MOBLAB')).toHaveCount(0);

	await semester.press('ArrowUp');
	await semester.press('ArrowUp');
	await semester.press('Enter');
	await expect(semester).toHaveText('Autumn (HS)');
	await expect(courseRow(page, 'ENLAB_MM')).toHaveCount(0);
	await expect(courseRow(page, 'MOBLAB')).toBeVisible();

	await semester.press('Home');
	await semester.press('Enter');
	await expect(options).toBeHidden();
	await expect(semester).toHaveText('All semesters');
	await expect(courseRow(page, 'ENLAB_MM')).toBeVisible();
	await expect(courseRow(page, 'MOBLAB')).toBeVisible();
});

test('settings receive keyboard focus and restore it when closed', async ({
	page,
}) => {
	await page.goto('/courses');
	const settings = page.getByRole('button', {
		name: 'Settings & help',
		exact: true,
	});
	const search = page.getByRole('textbox', { name: 'Search courses' });

	await settings.focus();
	await page.keyboard.press('Tab');
	await expect(search).toBeFocused();

	await settings.focus();
	await page.keyboard.press('Enter');
	await expect(
		page.getByRole('button', { name: 'Close settings', exact: true }),
	).toBeFocused();
	const theme = page.getByRole('combobox', { name: 'Theme', exact: true });
	await theme.focus();
	await expect(theme).toBeFocused();
	await theme.press('Escape');
	await expect(theme).toBeHidden();

	await expect(settings).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(search).toBeFocused();
});

test('assessment information opens on the course browser without leaking into navigation', async ({
	page,
}) => {
	await page.addInitScript(() =>
		localStorage.setItem('hslu-skill-tree-tutorial-seen', 'true'),
	);
	await page.goto('/courses');
	await page
		.getByRole('button', { name: 'Settings & help', exact: true })
		.click();
	await page
		.getByRole('button', { name: 'Assessment Information', exact: true })
		.click();
	const assessment = page.getByRole('dialog', {
		name: 'Assessment Stage Rules',
	});
	await expect(assessment).toBeVisible();
	await assessment
		.getByRole('button', { name: 'Close modal', exact: true })
		.click();
	await expect(assessment).toBeHidden();
	await page.getByRole('link', { name: 'Skill Tree', exact: true }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.locator('.svelte-flow__node').first()).toBeVisible();
	await expect(assessment).toBeHidden();
});

test('direct course browser visits resolve cloud conflicts and resume syncing', async ({
	page,
	login,
}) => {
	await page.addInitScript(() => {
		if (localStorage.getItem('theme') === null) {
			localStorage.setItem('theme', 'system');
		}
	});
	await login();
	await page.goto('/courses');
	await expect(
		page.getByRole('textbox', { name: 'Search courses' }),
	).toBeVisible();
	const original = await (await page.request.get('/api/progress')).json();
	await page.evaluate(() => localStorage.setItem('theme', 'light'));
	await page.reload();
	const conflict = page.getByRole('dialog', {
		name: 'Choose which progress to keep',
	});
	await expect(conflict).toBeVisible();
	await conflict.getByRole('button', { name: 'Use cloud data' }).click();
	await expect(conflict).toBeHidden();
	await page
		.getByRole('button', { name: 'Settings & help', exact: true })
		.click();
	const theme = page.getByRole('combobox', { name: 'Theme', exact: true });
	await expect(theme).toHaveText('System');
	await theme.click();
	await page.getByRole('option', { name: 'Dark', exact: true }).click();
	await expect
		.poll(async () => {
			const saved = await (await page.request.get('/api/progress')).json();
			return (
				saved.data.preferences.theme === 'dark' &&
				saved.revision > original.revision
			);
		})
		.toBe(true);
});

test('selected elective courses use the shared tabs and clearing returns to the picker', async ({
	page,
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('hslu-skill-tree-tutorial-seen', 'true');
		localStorage.setItem('currentTemplate', 'aiml-fulltime-hs24');
	});
	await page.goto('/');
	await page.locator('.svelte-flow__node[data-id="elective1-1"]').click();
	const panel = page.locator('#skill-tree-course-detail-panel');
	const picker = panel.getByRole('button', {
		name: 'Choose a course for this slot',
		exact: true,
	});
	await picker.click();
	await page
		.getByRole('option', {
			name: 'Distributed Systems & Components (VSK_MM) — 6 ECTS',
			exact: true,
		})
		.click();
	await expect(
		panel.getByRole('tab', { name: 'Overview', exact: true }),
	).toHaveAttribute('aria-selected', 'true');
	await expect(
		panel.getByRole('heading', { name: 'Prerequisites summary', exact: true }),
	).toBeVisible();
	await panel.getByRole('tab', { name: 'Prerequisites', exact: true }).click();
	await expect(
		panel.getByRole('heading', { name: 'Prerequisites', exact: true }),
	).toBeVisible();
	await panel.getByRole('tab', { name: 'Reviews', exact: true }).click();
	await expect(
		panel.getByRole('heading', { name: 'Student reviews', exact: true }),
	).toBeVisible();
	await panel.getByRole('button', { name: 'Clear', exact: true }).click();
	await expect(panel.getByRole('tab')).toHaveCount(0);
	await expect(picker).toBeVisible();
	await expect(
		panel.getByRole('heading', {
			name: 'Distributed Systems & Components',
			exact: true,
		}),
	).toHaveCount(0);
});

test('full prerequisites retain unused alternatives after a requirement is met', async ({
	page,
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('currentTemplate', 'aiml-fulltime-hs24');
		localStorage.setItem('slotStatus', JSON.stringify({ oop: 'completed' }));
	});
	await page.goto('/courses?course=VSK_MM');
	const panel = page.locator('#course-detail-panel');
	await expect(
		panel.getByRole('heading', { name: 'Prerequisites summary' }),
	).toBeVisible();
	await panel.getByRole('tab', { name: 'Prerequisites', exact: true }).click();
	const group = panel.getByRole('region', {
		name: 'Complete one of',
		exact: true,
	});
	await expect(group.getByText('Met', { exact: true })).toBeVisible();
	await expect(
		group.getByRole('button', { name: /OOP.*Completed/ }),
	).toBeVisible();
	await expect(
		group.getByRole('button', { name: /PLAB.*Not in plan/ }),
	).toBeVisible();
	await expect(group.getByText('Needs attention', { exact: true })).toHaveCount(
		0,
	);
});
