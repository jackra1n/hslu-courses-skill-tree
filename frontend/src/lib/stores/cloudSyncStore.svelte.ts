import { browser } from '$app/environment';
import { authClient } from '$lib/auth-client';
import {
	type AppData,
	applyAppData,
	collectAppData,
	parseAppData,
	serializeSnapshot,
} from '$lib/data/persistence';
import * as m from '$lib/paraglide/messages';

export type SyncStatus =
	| 'loading'
	| 'local'
	| 'saving'
	| 'synced'
	| 'error'
	| 'conflict';

type SyncUser = {
	id: string;
	name: string;
	email: string;
	image: string | null;
};

export type SyncConflict = {
	local: AppData;
	cloud: AppData;
	cloudRevision: number;
	cloudUpdatedAt: number;
	localUpdatedAt: number | null;
};

type SyncMetadata = {
	userId: string | null;
	revision: number | null;
	lastSyncedSnapshot: string | null;
	dirty: boolean;
	localUpdatedAt: number | null;
};

type CloudSnapshot = {
	data: AppData;
	revision: number;
	updatedAt: number;
};

const METADATA_KEY = 'hslu-skill-tree-cloud-sync';
const DEBOUNCE_MS = 1_000;
type SyncError = 'unavailable' | 'sign-in-failed';

let user = $state<SyncUser | null>(null);
let status = $state<SyncStatus>('loading');
let syncError = $state<SyncError | null>(null);
let conflict = $state<SyncConflict | null>(null);
let resolvingConflict = $state(false);

const metadata = $state<SyncMetadata>(loadMetadata());
// Observation is deliberately separate from the acknowledged cloud snapshot.
let observedSnapshot: string | null = null;
let pendingSnapshot: AppData | null = null;
let debounceTimer: number | undefined;
let inFlight: Promise<void> | null = null;
let initialization: Promise<void> | null = null;
let signingOut: Promise<void> | null = null;
let canWrite = false;

function isRevision(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function loadMetadata(): SyncMetadata {
	const empty: SyncMetadata = {
		userId: null,
		revision: null,
		lastSyncedSnapshot: null,
		dirty: false,
		localUpdatedAt: null,
	};
	if (!browser) return empty;
	try {
		const parsed = JSON.parse(localStorage.getItem(METADATA_KEY) ?? 'null');
		if (parsed && typeof parsed === 'object') {
			let lastSyncedSnapshot: string | null = null;
			if (typeof parsed.lastSyncedSnapshot === 'string') {
				const snapshot = parseAppData(JSON.parse(parsed.lastSyncedSnapshot));
				if (snapshot) lastSyncedSnapshot = serializeSnapshot(snapshot);
			}
			return {
				userId: typeof parsed.userId === 'string' ? parsed.userId : null,
				revision: isRevision(parsed.revision) ? parsed.revision : null,
				lastSyncedSnapshot,
				dirty: parsed.dirty === true,
				localUpdatedAt:
					typeof parsed.localUpdatedAt === 'number' &&
					Number.isFinite(parsed.localUpdatedAt)
						? parsed.localUpdatedAt
						: null,
			};
		}
	} catch {
		// Corrupt or legacy metadata cannot establish an acknowledged baseline.
	}
	return empty;
}

function persistMetadata(): void {
	if (browser) localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
}

function cancelDebounce(): void {
	window.clearTimeout(debounceTimer);
	debounceTimer = undefined;
}

function setUnavailable(): void {
	status = conflict ? 'conflict' : 'error';
	syncError = 'unavailable';
}

function setUser(next: SyncUser | null): void {
	// Check the persisted account before changing it, including after a reload.
	if (next && metadata.userId !== next.id) {
		metadata.revision = null;
		metadata.lastSyncedSnapshot = null;
		conflict = null;
		canWrite = false;
	}
	if (!next) canWrite = false;
	user = next;
	if (next) metadata.userId = next.id;
}

function observeLocal(data: AppData): string {
	const serialized = serializeSnapshot(data);
	if (observedSnapshot !== null && observedSnapshot !== serialized) {
		metadata.dirty = true;
		metadata.localUpdatedAt = Date.now();
		pendingSnapshot = data;
	}
	observedSnapshot = serialized;
	return serialized;
}

function parseCloudSnapshot(value: unknown): CloudSnapshot | null {
	if (!value || typeof value !== 'object') return null;
	const body = value as Partial<CloudSnapshot>;
	const data = parseAppData(body.data);
	if (
		!data ||
		!isRevision(body.revision) ||
		typeof body.updatedAt !== 'number' ||
		!Number.isFinite(body.updatedAt)
	)
		return null;
	return { data, revision: body.revision, updatedAt: body.updatedAt };
}

function acknowledge(serialized: string, revision: number): void {
	const local = collectAppData();
	const current = observeLocal(local);
	metadata.revision = revision;
	metadata.lastSyncedSnapshot = serialized;
	metadata.dirty = current !== serialized;
	pendingSnapshot = metadata.dirty ? local : null;
	if (!metadata.dirty) metadata.localUpdatedAt = null;
	persistMetadata();
	syncError = null;
	status = metadata.dirty ? 'saving' : 'synced';
}

function applyCloud(cloud: CloudSnapshot): void {
	applyAppData(cloud.data);
	observedSnapshot = serializeSnapshot(cloud.data);
	conflict = null;
	acknowledge(observedSnapshot, cloud.revision);
}

function showConflict(cloud: CloudSnapshot, local: AppData): void {
	metadata.dirty = true;
	pendingSnapshot = local;
	conflict = {
		local,
		cloud: cloud.data,
		cloudRevision: cloud.revision,
		cloudUpdatedAt: cloud.updatedAt,
		localUpdatedAt: metadata.localUpdatedAt,
	};
	persistMetadata();
	syncError = null;
	status = 'conflict';
}

function reconcileCloud(
	cloud: CloudSnapshot,
	localDataIsMeaningful: boolean,
	allowRebase: boolean,
): 'settled' | 'write' | 'conflict' {
	const local = collectAppData();
	const localSerialized = observeLocal(local);
	const cloudSerialized = serializeSnapshot(cloud.data);
	if (localSerialized === cloudSerialized) {
		conflict = null;
		acknowledge(cloudSerialized, cloud.revision);
		return 'settled';
	}

	const baseline = metadata.lastSyncedSnapshot;
	if (
		(baseline !== null && localSerialized === baseline) ||
		(baseline === null && !localDataIsMeaningful && !metadata.dirty)
	) {
		applyCloud(cloud);
		return 'settled';
	}

	// Revision identity proves the cloud did not change. A known baseline also
	// permits a rebase when only the revision changed, not the cloud contents.
	if (
		allowRebase &&
		(metadata.revision === cloud.revision ||
			(baseline !== null && cloudSerialized === baseline))
	) {
		conflict = null;
		acknowledge(cloudSerialized, cloud.revision);
		return 'write';
	}

	showConflict(cloud, local);
	return 'conflict';
}

// A 401 may revalidate and retry once, never loop on a valid cached session.
async function putSnapshot(
	snapshot: AppData,
	expectedRevision: number | null,
	userId: string,
): Promise<Response | null> {
	const body = JSON.stringify({ data: snapshot, expectedRevision });
	for (let attempt = 0; attempt < 2; attempt++) {
		const response = await fetch('/api/progress', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body,
		});
		if (user?.id !== userId) return null;
		if (response.status !== 401 || attempt === 1) return response;
		const session = await authClient.getSession();
		if (user?.id !== userId) return null;
		if (session.error) throw new Error('Session unavailable');
		if (session.data?.user?.id !== userId) {
			setUser(null);
			conflict = null;
			status = 'local';
			return null;
		}
	}
	return null;
}

async function writePending(
	userId: string,
	resolution: SyncConflict | null,
): Promise<void> {
	let expectedRevision = resolution?.cloudRevision ?? metadata.revision;
	let rebased = false;
	try {
		while (pendingSnapshot && user?.id === userId) {
			// Keep this queued until acknowledgement. Failures must not restore an
			// older request over a newer edit that arrived during the await.
			const snapshot = pendingSnapshot;
			const serialized = serializeSnapshot(snapshot);
			status = 'saving';
			syncError = null;
			const response = await putSnapshot(snapshot, expectedRevision, userId);
			if (!response || user?.id !== userId) return;

			if (response.status === 409) {
				const cloud = parseCloudSnapshot(await response.json());
				if (user?.id !== userId) return;
				if (!cloud) throw new Error('Invalid cloud snapshot');
				const cloudSerialized = serializeSnapshot(cloud.data);
				if (cloudSerialized === serialized) {
					// This request is already present remotely. Acknowledge it
					// without discarding edits queued while it was in flight.
					conflict = null;
					acknowledge(serialized, cloud.revision);
					expectedRevision = cloud.revision;
					resolution = null;
					continue;
				}
				// A deliberate local choice is not permission to overwrite a newer
				// divergent cloud version. Equal data still needs no second choice.
				if (resolution) {
					const local = collectAppData();
					if (observeLocal(local) !== cloudSerialized) {
						showConflict(cloud, local);
						return;
					}
				}
				const outcome = reconcileCloud(cloud, true, !rebased);
				if (outcome !== 'write') return;
				rebased = true;
				expectedRevision = metadata.revision;
				continue;
			}

			if (!response.ok) throw new Error('Cloud write unavailable');
			const body: unknown = await response.json();
			if (user?.id !== userId) return;
			if (
				!body ||
				typeof body !== 'object' ||
				!('revision' in body) ||
				!isRevision(body.revision) ||
				!('updatedAt' in body) ||
				typeof body.updatedAt !== 'number' ||
				!Number.isFinite(body.updatedAt)
			)
				throw new Error('Invalid cloud acknowledgement');

			conflict = null;
			acknowledge(serialized, body.revision);
			expectedRevision = metadata.revision;
			resolution = null;
		}
	} catch {
		if (user?.id === userId) setUnavailable();
	}
}

// The shared promise covers the entire drain, including conflict resolution.
// Internal lifecycle callers may drain while public debounce/online writes pause.
function startPendingWrite(
	resolution: SyncConflict | null = null,
): Promise<void> {
	if (inFlight) return inFlight;
	if (!user || !canWrite || !pendingSnapshot || (conflict && !resolution))
		return Promise.resolve();
	cancelDebounce();
	inFlight = writePending(user.id, resolution).finally(() => {
		inFlight = null;
		resolvingConflict = false;
	});
	return inFlight;
}

function flushPending(): Promise<void> {
	if (inFlight) return inFlight;
	if (initialization || signingOut) return Promise.resolve();
	return startPendingWrite();
}

async function initialize(localDataIsMeaningful: boolean): Promise<void> {
	try {
		await inFlight;
		observeLocal(collectAppData());
		const session = await authClient.getSession();
		if (session.error) throw new Error('Session unavailable');
		const sessionUser = session.data?.user;
		if (!sessionUser) {
			setUser(null);
			conflict = null;
			persistMetadata();
			syncError = null;
			status = 'local';
			return;
		}

		const sameAccount = metadata.userId === sessionUser.id;
		setUser({
			id: sessionUser.id,
			name: sessionUser.name,
			email: sessionUser.email,
			image: sessionUser.image ?? null,
		});
		const userId = sessionUser.id;
		const local = collectAppData();
		const serialized = observeLocal(local);
		if (
			metadata.lastSyncedSnapshot !== null &&
			serialized !== metadata.lastSyncedSnapshot
		)
			metadata.dirty = true;
		if (metadata.dirty) pendingSnapshot = local;
		persistMetadata();

		// Route initialization must settle its own debounce before reading an
		// older cloud version. An acknowledged account revision makes PUT safe.
		canWrite = canWrite || (sameAccount && metadata.revision !== null);
		if (canWrite && pendingSnapshot && !conflict) {
			await startPendingWrite();
			if (user?.id !== userId || status === 'error' || conflict) return;
		}

		const response = await fetch('/api/progress', { method: 'GET' });
		if (user?.id !== userId) return;
		if (response.status === 401) {
			setUser(null);
			conflict = null;
			status = 'local';
			return;
		}
		if (response.status === 404) {
			metadata.revision = null;
			metadata.lastSyncedSnapshot = null;
			metadata.dirty = true;
			metadata.localUpdatedAt ??= Date.now();
			pendingSnapshot = collectAppData();
			observeLocal(pendingSnapshot);
			conflict = null;
			canWrite = true;
			persistMetadata();
			await startPendingWrite();
			return;
		}
		if (!response.ok) throw new Error('Cloud read unavailable');
		const cloud = parseCloudSnapshot(await response.json());
		if (user?.id !== userId) return;
		if (!cloud) throw new Error('Invalid cloud snapshot');
		canWrite = true;
		if (reconcileCloud(cloud, localDataIsMeaningful, true) === 'write')
			await startPendingWrite();
	} catch {
		setUnavailable();
	}
}

export const cloudSyncStore = {
	get user() {
		return user;
	},
	get status() {
		return status;
	},
	get errorMessage() {
		if (syncError === 'unavailable') return m.sync_unavailable();
		if (syncError === 'sign-in-failed') return m.account_sign_in_failed();
		return null;
	},
	get conflict() {
		return conflict;
	},
	get resolvingConflict() {
		return resolvingConflict;
	},

	init(localDataIsMeaningful: boolean): Promise<void> {
		if (!browser) {
			status = 'local';
			return Promise.resolve();
		}
		if (initialization) return initialization;
		if (signingOut)
			return signingOut.then(() => cloudSyncStore.init(localDataIsMeaningful));
		cancelDebounce();
		initialization = initialize(localDataIsMeaningful).finally(() => {
			initialization = null;
		});
		return initialization;
	},

	recordLocalSnapshot(data: AppData): void {
		if (observedSnapshot === null) return;
		const previous = observedSnapshot;
		if (observeLocal(data) === previous) return;
		persistMetadata();
		if (conflict) {
			conflict = {
				...conflict,
				local: data,
				localUpdatedAt: metadata.localUpdatedAt,
			};
			return;
		}
		if (!user || !canWrite || initialization || signingOut) return;
		cancelDebounce();
		debounceTimer = window.setTimeout(() => {
			debounceTimer = undefined;
			void flushPending();
		}, DEBOUNCE_MS);
	},

	async signInWithGitHub(callbackURL = window.location.href): Promise<void> {
		syncError = null;
		try {
			const result = await authClient.signIn.social({
				provider: 'github',
				callbackURL,
			});
			if (result.error) {
				status = 'error';
				syncError = 'sign-in-failed';
			}
		} catch {
			status = 'error';
			syncError = 'sign-in-failed';
		}
	},

	signOut(): Promise<void> {
		if (signingOut) return signingOut;
		signingOut = (async () => {
			try {
				await initialization;
				cancelDebounce();
				await inFlight;
				await startPendingWrite();
				const result = await authClient.signOut();
				if (result.error) throw new Error('Sign-out unavailable');
				setUser(null);
				conflict = null;
				syncError = null;
				status = 'local';
			} catch {
				setUnavailable();
			}
		})().finally(() => {
			signingOut = null;
		});
		return signingOut;
	},

	useCloudConflict(): void {
		if (
			!conflict ||
			resolvingConflict ||
			inFlight ||
			initialization ||
			signingOut
		)
			return;
		try {
			cancelDebounce();
			applyCloud({
				data: conflict.cloud,
				revision: conflict.cloudRevision,
				updatedAt: conflict.cloudUpdatedAt,
			});
		} catch {
			setUnavailable();
		}
	},

	async useLocalConflict(): Promise<void> {
		if (resolvingConflict || inFlight) {
			await inFlight;
			return;
		}
		if (!conflict || !user || initialization || signingOut) return;
		try {
			resolvingConflict = true;
			pendingSnapshot = collectAppData();
			observeLocal(pendingSnapshot);
			metadata.dirty = true;
			persistMetadata();
			await startPendingWrite(conflict);
		} catch {
			setUnavailable();
		} finally {
			resolvingConflict = false;
		}
	},

	armOnlineRetry(): void {
		if (!browser) return;
		window.addEventListener('online', () => {
			if (metadata.dirty && user && !conflict && pendingSnapshot)
				void flushPending();
		});
	},
};

if (browser) cloudSyncStore.armOnlineRetry();
