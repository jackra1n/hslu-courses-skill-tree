import { getLocale } from '$lib/paraglide/runtime';

// The catalog carries both names: `label` (German, the HSLU source language)
// and `labelEn` (English, when HSLU provides one). Reading getLocale() inside
// keeps every derived consumer reactive to language switches: the runtime's
// getLocale is overwritten by stores/locale.svelte.ts with a $state-backed
// closure, so calling it inside a derived tracks locale changes.
export function courseLabel(course: {
	label: string;
	labelEn?: string;
}): string {
	if (getLocale() === 'en') return course.labelEn || course.label;
	return course.label;
}
