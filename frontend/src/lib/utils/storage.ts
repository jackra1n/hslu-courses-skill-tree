import { browser } from '$app/environment';

function warn(action: string, key: string, error: unknown): void {
	console.warn(`Could not ${action} "${key}" in local storage`, error);
}

export function readStorage(key: string): string | null {
	try {
		if (!browser) return null;
		return localStorage.getItem(key);
	} catch (error) {
		warn('read', key, error);
		return null;
	}
}

export function writeStorage(key: string, value: string): boolean {
	try {
		if (!browser) return false;
		localStorage.setItem(key, value);
		return true;
	} catch (error) {
		warn('write', key, error);
		return false;
	}
}

export function removeStorage(key: string): void {
	try {
		if (browser) localStorage.removeItem(key);
	} catch (error) {
		warn('remove', key, error);
	}
}

export function storageKeys(prefix: string): string[] {
	try {
		if (!browser) return [];
		const keys: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(prefix)) keys.push(key);
		}
		return keys;
	} catch (error) {
		warn('list', `${prefix}*`, error);
		return [];
	}
}
