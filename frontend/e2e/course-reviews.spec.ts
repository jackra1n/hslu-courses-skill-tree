import type { Locator, Route } from '@playwright/test';
import { expect, test } from './fixtures';

type Ratings = {
	recommendation: number;
	contentInterest: number;
	difficulty: number;
	workload: number;
};

const dimensions = [
	['recommendation', 'Recommendation'],
	['contentInterest', 'Content interest'],
	['difficulty', 'Difficulty'],
	['workload', 'Workload'],
] as const;
const originalRatings: Ratings = {
	recommendation: 4,
	contentInterest: 5,
	difficulty: 2,
	workload: 3,
};
const updatedRatings: Ratings = {
	recommendation: 3,
	contentInterest: 4,
	difficulty: 5,
	workload: 1,
};
const courseUrl = '/courses?course=WEBLAB';

function ratingInput(form: Locator, label: string, score: number) {
	return form
		.getByRole('group', { name: label, exact: true })
		.getByRole('radio', { name: new RegExp(`^${score}(?:\\D|$)`) });
}

async function fillRatings(form: Locator, ratings: Ratings) {
	for (const [key, label] of dimensions) {
		// the native inputs are visually hidden behind their rating labels.
		// space exercises their keyboard behavior without forced pointer clicks.
		await ratingInput(form, label, ratings[key]).press('Space');
	}
}

async function expectDraft(form: Locator, ratings: Ratings, text: string) {
	await expect(
		form.getByRole('textbox', { name: 'Your experience (optional)' }),
	).toHaveValue(text);
	for (const [key, label] of dimensions) {
		await expect(ratingInput(form, label, ratings[key])).toBeChecked();
	}
}

async function expectPublishedRatings(article: Locator, ratings: Ratings) {
	const details = article.getByRole('button', {
		name: 'Review ratings',
		exact: true,
	});
	await details.click();
	const tooltip = article.getByRole('tooltip');
	await expect(tooltip).toBeVisible();
	for (const [key, label] of dimensions) {
		const dimension = tooltip.getByText(label, { exact: true }).locator('..');
		if (key === 'recommendation' || key === 'contentInterest') {
			await expect(
				dimension.getByRole('img', {
					name: `${ratings[key]} out of 5 stars`,
					exact: true,
				}),
			).toBeVisible();
		} else {
			await expect(
				dimension.getByText(`${ratings[key]}/5`, { exact: true }),
			).toBeVisible();
		}
	}
	await details.press('Escape');
	await expect(tooltip).toBeHidden();
	await expect(article).toBeVisible();
}

test('a reviewer can publish, edit and cancel or confirm deletion with persistent results', async ({
	page,
	login,
}) => {
	await login();
	await page.goto(courseUrl);
	const reviews = page.getByRole('region', {
		name: 'Student reviews',
		exact: true,
	});
	const originalText = 'The practical web exercises made the concepts clear.';
	const updatedText =
		'After the final project, I found the material more challenging but the workload manageable.';

	await reviews
		.getByRole('button', { name: 'Write a review', exact: true })
		.click();
	const createForm = reviews.getByRole('form', {
		name: 'Write a review',
		exact: true,
	});
	await fillRatings(createForm, originalRatings);
	await createForm
		.getByRole('textbox', { name: 'Your experience (optional)' })
		.fill(originalText);
	await createForm
		.getByRole('button', { name: 'Publish review', exact: true })
		.click();
	await expect(reviews.getByRole('article')).toHaveCount(1);
	await expect(reviews.getByRole('article')).toContainText(originalText);

	await page.reload();
	const article = reviews.getByRole('article');
	await expect(article).toHaveCount(1);
	await expect(article).toContainText(originalText);
	await expect(
		article.getByRole('heading', { name: 'Your review', exact: true }),
	).toBeVisible();
	await expectPublishedRatings(article, originalRatings);

	await reviews
		.getByRole('button', { name: 'Edit review', exact: true })
		.click();
	const editForm = reviews.getByRole('form', {
		name: 'Edit review',
		exact: true,
	});
	await expectDraft(editForm, originalRatings, originalText);
	await fillRatings(editForm, updatedRatings);
	await editForm
		.getByRole('textbox', { name: 'Your experience (optional)' })
		.fill(updatedText);
	await editForm
		.getByRole('button', { name: 'Save changes', exact: true })
		.click();
	await expect(article).toContainText(updatedText);
	await expect(article).not.toContainText(originalText);

	await page.reload();
	await expect(article).toHaveCount(1);
	await expect(article).toContainText(updatedText);
	await expectPublishedRatings(article, updatedRatings);

	await reviews
		.getByRole('button', { name: 'Delete review', exact: true })
		.click();
	const confirmation = page.getByRole('dialog', {
		name: 'Delete your review?',
		exact: true,
	});
	await expect(confirmation).toBeVisible();
	await confirmation
		.getByRole('button', { name: 'Cancel', exact: true })
		.click();
	await expect(confirmation).toBeHidden();
	await expect(article).toContainText(updatedText);
	await page.reload();
	await expect(article).toContainText(updatedText);

	await reviews
		.getByRole('button', { name: 'Delete review', exact: true })
		.click();
	await confirmation
		.getByRole('button', { name: 'Delete review', exact: true })
		.click();
	await expect(confirmation).toBeHidden();
	await expect(article).toHaveCount(0);
	await expect(
		reviews.getByRole('button', { name: 'Write a review', exact: true }),
	).toBeVisible();
	await page.reload();
	await expect(
		reviews.getByRole('button', { name: 'Write a review', exact: true }),
	).toBeVisible();
	await expect(article).toHaveCount(0);
	await expect(
		reviews.getByRole('button', { name: 'Edit review', exact: true }),
	).toHaveCount(0);
	await expect(
		reviews.getByRole('button', { name: 'Delete review', exact: true }),
	).toHaveCount(0);
});

test('guests and another account can read an anonymous review but cannot edit or delete it', async ({
	page,
	context,
	login,
}) => {
	const author = 'Review Author Private Name';
	const reader = 'Different Review Reader';
	const text = 'The weekly exercises are useful preparation for the project.';
	await login(author);
	await page.goto(courseUrl);
	const reviews = page.getByRole('region', {
		name: 'Student reviews',
		exact: true,
	});
	await reviews
		.getByRole('button', { name: 'Write a review', exact: true })
		.click();
	const form = reviews.getByRole('form', {
		name: 'Write a review',
		exact: true,
	});
	await fillRatings(form, originalRatings);
	await form
		.getByRole('textbox', { name: 'Your experience (optional)' })
		.fill(text);
	await form
		.getByRole('button', { name: 'Publish review', exact: true })
		.click();
	await expect(reviews.getByRole('article')).toContainText(text);
	await expect(reviews).not.toContainText(author);

	await context.clearCookies();
	await page.reload();
	await expect(
		reviews.getByRole('button', { name: 'Continue with GitHub', exact: true }),
	).toBeVisible();
	await expect(reviews.getByRole('article')).toHaveCount(1);
	await expect(reviews.getByRole('article')).toContainText(text);
	await expectPublishedRatings(reviews.getByRole('article'), originalRatings);
	await expect(
		reviews.getByRole('heading', { name: 'Your review', exact: true }),
	).toHaveCount(0);
	await expect(
		reviews.getByRole('button', { name: 'Write a review', exact: true }),
	).toHaveCount(0);
	await expect(
		reviews.getByRole('button', { name: 'Edit review', exact: true }),
	).toHaveCount(0);
	await expect(
		reviews.getByRole('button', { name: 'Delete review', exact: true }),
	).toHaveCount(0);
	await expect(reviews).not.toContainText(author);

	await login(reader);
	await page.reload();
	await expect(
		reviews.getByRole('button', { name: 'Write a review', exact: true }),
	).toBeVisible();
	await expect(reviews.getByRole('article')).toHaveCount(1);
	await expect(reviews.getByRole('article')).toContainText(text);
	await expect(
		reviews.getByRole('heading', { name: 'Your review', exact: true }),
	).toHaveCount(0);
	await expect(
		reviews.getByRole('button', { name: 'Edit review', exact: true }),
	).toHaveCount(0);
	await expect(
		reviews.getByRole('button', { name: 'Delete review', exact: true }),
	).toHaveCount(0);
	await expect(reviews).not.toContainText(author);
	await expect(reviews).not.toContainText(reader);
	await reviews
		.getByRole('button', { name: 'Write a review', exact: true })
		.click();
	await expect(
		form.getByRole('textbox', { name: 'Your experience (optional)' }),
	).toHaveValue('');
	await expect(form.getByRole('radio', { checked: true })).toHaveCount(0);
	await form.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(reviews.getByRole('article')).toContainText(text);
});

test('a failed write keeps every draft field and a real retry persists exactly one review', async ({
	page,
	login,
}) => {
	await login();
	await page.goto(courseUrl);
	const reviews = page.getByRole('region', {
		name: 'Student reviews',
		exact: true,
	});
	const text =
		'Keep this draft, including the ratings, when the connection drops.\nThe project was rewarding.';
	await reviews
		.getByRole('button', { name: 'Write a review', exact: true })
		.click();
	const form = reviews.getByRole('form', {
		name: 'Write a review',
		exact: true,
	});
	await fillRatings(form, originalRatings);
	await form
		.getByRole('textbox', { name: 'Your experience (optional)' })
		.fill(text);

	const endpoint = '**/api/courses/WEBLAB/reviews';
	const abortSave = async (route: Route) => {
		if (route.request().method() === 'POST') await route.abort('failed');
		else await route.continue();
	};
	await page.route(endpoint, abortSave);
	await form
		.getByRole('button', { name: 'Publish review', exact: true })
		.click();
	await expect(reviews.getByRole('alert')).toContainText(/could not be saved/i);
	await expectDraft(form, originalRatings, text);
	await expect(
		form.getByRole('button', { name: 'Publish review', exact: true }),
	).toBeEnabled();
	await expect(reviews.getByRole('article')).toHaveCount(0);

	await page.unroute(endpoint, abortSave);
	await form
		.getByRole('button', { name: 'Publish review', exact: true })
		.click();
	await expect(form).toHaveCount(0);
	await expect(reviews.getByRole('alert')).toHaveCount(0);
	await expect(reviews.getByRole('article')).toHaveCount(1);
	await expect(reviews.getByRole('article')).toContainText(text);
	await page.reload();
	await expect(
		reviews.getByRole('button', { name: 'Edit review', exact: true }),
	).toBeVisible();
	await expect(reviews.getByRole('article')).toHaveCount(1);
	await expect(reviews.getByRole('article')).toContainText(text);
	await expectPublishedRatings(reviews.getByRole('article'), originalRatings);
});
