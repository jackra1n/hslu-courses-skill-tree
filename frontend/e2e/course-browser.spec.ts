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

test('closed settings stay out of keyboard navigation', async ({ page }) => {
	await page.goto('/courses');
	const settings = page.getByRole('button', {
		name: 'Settings & help',
		exact: true,
	});
	const search = page.getByRole('textbox', { name: 'Search courses' });

	await settings.focus();
	await page.keyboard.press('Tab');
	await expect(search).toBeFocused();

	await settings.click();
	const theme = page.getByRole('combobox', { name: 'Theme', exact: true });
	await theme.focus();
	await expect(theme).toBeFocused();
	await theme.press('Escape');
	await expect(theme).toBeHidden();

	await settings.focus();
	await page.keyboard.press('Tab');
	await expect(search).toBeFocused();
});
