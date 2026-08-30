import {
	type Locale,
	locales,
	overwriteGetLocale,
	overwriteSetLocale,
	setLocale,
} from '$lib/paraglide/runtime';

const LOCALE_KEY = 'locale';

// Bind paraglide's locale resolution to Svelte 5 state: messages call
// getLocale() while rendering, so reading $state here re-renders every
// message when the locale changes.
let _locale = $state<Locale>('en');

overwriteGetLocale(() => _locale);
overwriteSetLocale((newLocale) => {
	if (typeof localStorage !== 'undefined')
		localStorage.setItem(LOCALE_KEY, newLocale);
	applyLocale(newLocale);
});

function applyLocale(newLocale: Locale) {
	if (typeof document !== 'undefined')
		document.documentElement.lang = newLocale;
	_locale = newLocale;
}

export function locale(): Locale {
	return _locale;
}

export function isLocale(value: string): value is Locale {
	return (locales as readonly string[]).includes(value);
}

function detectLocale(): Locale {
	const stored = localStorage.getItem(LOCALE_KEY);
	if (stored && isLocale(stored)) return stored;
	const preferred = navigator.language.slice(0, 2);
	return isLocale(preferred) ? preferred : 'en';
}

export const localeStore = {
	set: setLocale,
	init: () => {
		if (typeof localStorage === 'undefined') return;
		applyLocale(detectLocale());
	},
};
