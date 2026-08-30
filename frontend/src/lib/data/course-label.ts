import { locale } from '$lib/stores/locale.svelte';

// The catalog carries both names: `label` (German, the HSLU source language)
// and `labelEn` (English, when HSLU provides one). Reading `locale()` inside
// keeps every derived consumer reactive to language switches.
export function courseLabel(course: { label: string; labelEn?: string }): string {
	if (locale() === 'en') return course.labelEn || course.label;
	return course.label;
}
