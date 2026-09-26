import { beforeEach, describe, expect, mock, test } from 'bun:test';

await mock.module('$app/environment', () => ({ browser: true }));
const { backupStorage, restoreStorage, writeStorage } = await import(
	'../src/lib/utils/storage'
);

class QuotaStorage {
	private values = new Map<string, string>();
	constructor(private quota: number) {}

	get length() {
		return this.values.size;
	}
	key(index: number) {
		return [...this.values.keys()][index] ?? null;
	}
	getItem(key: string) {
		return this.values.get(key) ?? null;
	}
	setItem(key: string, value: string) {
		let used = value.length;
		for (const [k, v] of this.values) if (k !== key) used += v.length;
		if (used > this.quota) {
			throw new DOMException('full', 'QuotaExceededError');
		}
		this.values.set(key, value);
	}
	removeItem(key: string) {
		this.values.delete(key);
	}
}

let storage: QuotaStorage;

beforeEach(() => {
	storage = new QuotaStorage(10);
	globalThis.localStorage = storage as unknown as Storage;
});

describe('restoreStorage', () => {
	test('restores values that fit by freeing space first', () => {
		storage.setItem('A', '12345678');
		storage.setItem('B', '12');
		const backup = backupStorage(['A', 'B', 'C']);
		if (!backup) throw new Error('backup failed');

		storage.setItem('A', '12');
		storage.setItem('B', '12345678');

		expect(restoreStorage(backup)).toBe(true);
		expect(storage.getItem('A')).toBe('12345678');
		expect(storage.getItem('B')).toBe('12');
	});

	test('removes keys that did not exist before', () => {
		storage.setItem('A', '1234');
		const backup = backupStorage(['A', 'B']);
		if (!backup) throw new Error('backup failed');

		storage.setItem('B', '123456');
		storage.setItem('A', '1');

		expect(restoreStorage(backup)).toBe(true);
		expect(storage.getItem('A')).toBe('1234');
		expect(storage.getItem('B')).toBeNull();
	});

	test('reports a restore that cannot fit', () => {
		const backup = new Map([['A', '12345678901']]);
		expect(restoreStorage(backup)).toBe(false);
		expect(writeStorage('A', '1')).toBe(true);
	});
});
