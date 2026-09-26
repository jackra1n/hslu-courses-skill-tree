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

export function removeStorage(key: string): boolean {
	try {
		if (!browser) return false;
		localStorage.removeItem(key);
		return true;
	} catch (error) {
		warn('remove', key, error);
		return false;
	}
}

export function storageKeys(prefix: string): string[] | null {
	try {
		if (!browser) return null;
		const keys: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(prefix)) keys.push(key);
		}
		return keys;
	} catch (error) {
		warn('list', `${prefix}*`, error);
		return null;
	}
}

export function backupStorage(
	keys: Iterable<string>,
): Map<string, string | null> | null {
	try {
		if (!browser) return null;
		const backup = new Map<string, string | null>();
		for (const key of keys) backup.set(key, localStorage.getItem(key));
		return backup;
	} catch (error) {
		warn('back up', [...keys].join(', '), error);
		return null;
	}
}

export function restoreStorage(backup: Map<string, string | null>): boolean {
	const size = (value: string | null) => value?.length ?? 0;
	const changes = [...backup].map(([key, value]) => ({
		key,
		value,
		growth: size(value) - size(readStorage(key)),
	}));
	changes.sort((a, b) => a.growth - b.growth);

	let restored = true;
	for (const { key, value } of changes) {
		const done = value === null ? removeStorage(key) : writeStorage(key, value);
		restored = done && restored;
	}
	return restored;
}
