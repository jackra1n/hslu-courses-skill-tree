import { browser } from '$app/environment';
import { authClient } from '$lib/auth-client';
import {
	type AppData,
	applyAppData,
	collectAppData,
	parseAppData,
} from '$lib/data/persistence';
import * as messages from '$lib/paraglide/messages';

// ---- public state -----------------------------------------------------------

export type SyncStatus =
	| 'loading'
	| 'local'
	| 'saving'
	| 'synced'
	| 'error'
	| 'conflict';

export type SyncUser = {
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
	dirty: boolean;
	localUpdatedAt: number | null;
};

const METADATA_KEY = 'hslu-skill-tree-cloud-sync';
const DEBOUNCE_MS = 1_000;
// Locale-aware at call time, not import time.
const LOCAL_SAFETY_MESSAGE = () => messages.sync_unavailable();
const SIGN_IN_FAILED_MESSAGE = () => messages.account_sign_in_failed();
// ---- private state ----------------------------------------------------------

let user = $state<SyncUser | null>(null);
let status = $state<SyncStatus>('loading');
let errorMessage = $state<string | null>(null);
let conflict = $state<SyncConflict | null>(null);

let metadata = $state<SyncMetadata>(loadMetadata());
let baseline: string | null = null; // last known serialized AppData
let pendingSnapshot: AppData | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;

function loadMetadata(): SyncMetadata {
	if (!browser)
		return { userId: null, revision: null, dirty: false, localUpdatedAt: null };
	try {
		const parsed = JSON.parse(localStorage.getItem(METADATA_KEY) ?? 'null');
		if (parsed && typeof parsed === 'object') {
			return {
				userId: typeof parsed.userId === 'string' ? parsed.userId : null,
				revision: typeof parsed.revision === 'number' ? parsed.revision : null,
				dirty: parsed.dirty === true,
				localUpdatedAt:
					typeof parsed.localUpdatedAt === 'number'
						? parsed.localUpdatedAt
						: null,
			};
		}
	} catch {
		// corrupt metadata: start fresh
	}
	return { userId: null, revision: null, dirty: false, localUpdatedAt: null };
}

function persistMetadata(): void {
	if (!browser) return;
	localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
}

function serialize(data: AppData): string {
	return JSON.stringify(data);
}

function setUser(next: SyncUser | null): void {
	user = next;
	if (next) metadata.userId = next.id;
}

// ---- writes ----------------------------------------------------------------

// Attempts the pending snapshot write. Never throws; every outcome lands in a
// stable status. Only one write runs at a time; a newer pending snapshot that
// arrives mid-flight is flushed again afterwards.
async function flushPending(): Promise<void> {
	if (inFlight || !user || !pendingSnapshot || status === 'conflict') return;
	inFlight = true;
	try {
		while (pendingSnapshot && user) {
			const snapshot: AppData = pendingSnapshot;
			pendingSnapshot = null;
			status = 'saving';
			errorMessage = null;

			const response = await fetch('/api/progress', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					data: snapshot,
					expectedRevision: metadata.revision,
				}),
			});

			if (response.status === 401) {
				// Session expired mid-flight: revalidate once before giving up.
				const session = await authClient.getSession();
				if (!session.data?.user) {
					// Remains dirty; back to local mode, never retry an expired session.
					pendingSnapshot = snapshot;
					setUser(null);
					metadata.revision = null;
					persistMetadata();
					status = 'local';
					return;
				}
				pendingSnapshot = snapshot;
				continue;
			}

			if (response.status === 409) {
				const body = await response.json();
				const cloud = parseAppData(body?.data);
				if (!cloud) {
					pendingSnapshot = snapshot;
					status = 'error';
					errorMessage = LOCAL_SAFETY_MESSAGE();
					return;
				}
				conflict = {
					local: collectAppData(),
					cloud,
					cloudRevision: body.revision,
					cloudUpdatedAt: body.updatedAt,
					localUpdatedAt: metadata.localUpdatedAt,
				};
				status = 'conflict';
				return;
			}

			if (!response.ok) {
				pendingSnapshot = snapshot; // retry on next change or online
				status = 'error';
				errorMessage = LOCAL_SAFETY_MESSAGE();
				return;
			}

			let body: { revision?: unknown; updatedAt?: unknown };
			try {
				body = await response.json();
			} catch {
				pendingSnapshot = snapshot;
				status = 'error';
				errorMessage = LOCAL_SAFETY_MESSAGE();
				return;
			}
			if (typeof body.revision !== 'number') {
				pendingSnapshot = snapshot;
				status = 'error';
				errorMessage = LOCAL_SAFETY_MESSAGE();
				return;
			}

			metadata.revision = body.revision;
			metadata.dirty = false;
			persistMetadata();
			baseline = serialize(snapshot);
			status = 'synced';
		}
	} catch {
		status = 'error';
		errorMessage = LOCAL_SAFETY_MESSAGE();
	} finally {
		inFlight = false;
	}
}

// ---- public store -----------------------------------------------------------

export const cloudSyncStore = {
	get user() {
		return user;
	},
	get status() {
		return status;
	},
	get errorMessage() {
		return errorMessage;
	},
	get conflict() {
		return conflict;
	},

	async init(localDataIsMeaningful: boolean): Promise<void> {
		if (!browser) {
			status = 'local';
			return;
		}

		let session: Awaited<ReturnType<typeof authClient.getSession>>;
		try {
			session = await authClient.getSession();
		} catch {
			status = 'error';
			errorMessage = LOCAL_SAFETY_MESSAGE();
			return;
		}

		const sessionUser = session.data?.user;
		if (!sessionUser) {
			setUser(null);
			// Baseline the current local state so later signed-out edits mark
			// the metadata dirty and sync on the next sign-in.
			baseline = serialize(collectAppData());
			status = 'local';
			return;
		}
		setUser({
			id: sessionUser.id,
			name: sessionUser.name,
			email: sessionUser.email,
			image: sessionUser.image ?? null,
		});

		const localSnapshot = collectAppData();
		const localSerialized = serialize(localSnapshot);

		let cloudResponse: Response;
		try {
			cloudResponse = await fetch('/api/progress', { method: 'GET' });
		} catch {
			status = 'error';
			errorMessage = LOCAL_SAFETY_MESSAGE();
			return;
		}

		if (cloudResponse.status === 401) {
			// Session was invalid despite getSession: drop back to local mode.
			setUser(null);
			metadata.revision = null;
			persistMetadata();
			status = 'local';
			return;
		}

		if (cloudResponse.status === 404) {
			// No cloud row: push the current local state as revision 1.
			pendingSnapshot = localSnapshot;
			baseline = localSerialized;
			metadata.localUpdatedAt = metadata.localUpdatedAt ?? Date.now();
			await flushPending();
			return;
		}

		if (!cloudResponse.ok) {
			status = 'error';
			errorMessage = LOCAL_SAFETY_MESSAGE();
			return;
		}

		const body = await cloudResponse.json();
		const cloud = parseAppData(body?.data);
		if (!cloud) {
			status = 'error';
			errorMessage = LOCAL_SAFETY_MESSAGE();
			return;
		}

		const cloudSerialized = serialize(cloud);
		if (cloudSerialized === localSerialized) {
			// Already in sync: adopt the server revision/timestamp.
			metadata.revision = body.revision;
			metadata.dirty = false;
			metadata.localUpdatedAt = null;
			persistMetadata();
			baseline = localSerialized;
			status = 'synced';
			return;
		}

		const hasLocalChanges = localDataIsMeaningful || metadata.dirty;
		if (!hasLocalChanges) {
			// Fresh browser: the cloud snapshot wins, no echo write.
			applyAppData(cloud);
			metadata.revision = body.revision;
			metadata.dirty = false;
			metadata.localUpdatedAt = null;
			persistMetadata();
			baseline = cloudSerialized;
			status = 'synced';
			return;
		}

		// Both sides have real data: ask the user, never write blindly.
		conflict = {
			local: localSnapshot,
			cloud,
			cloudRevision: body.revision,
			cloudUpdatedAt: body.updatedAt,
			localUpdatedAt: metadata.localUpdatedAt,
		};
		baseline = localSerialized;
		status = 'conflict';
	},

	// Called by the root snapshot effect on every AppData change.
	recordLocalSnapshot(data: AppData): void {
		if (baseline === null) return; // init not finished
		const serialized = serialize(data);
		if (serialized === baseline) return;

		baseline = serialized;
		metadata.localUpdatedAt = Date.now();
		metadata.dirty = true;
		persistMetadata();

		if (!user || status === 'conflict') return;

		pendingSnapshot = data;
		if (debounceTimer !== null) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			void flushPending();
		}, DEBOUNCE_MS);
	},

	async signInWithGitHub(): Promise<void> {
		try {
			await authClient.signIn.social({
				provider: 'github',
				callbackURL: window.location.origin,
			});
		} catch {
			status = 'error';
			errorMessage = SIGN_IN_FAILED_MESSAGE();
		}
	},

	async signOut(): Promise<void> {
		await flushPending();
		try {
			await authClient.signOut();
		} catch {
			// sign-out failure still leaves local data intact below
		}
		setUser(null);
		status = 'local';
	},

	// Replace local state with the cloud snapshot; no echo write because the
	// root snapshot effect sees the applied state matching the new baseline.
	useCloudConflict(): void {
		if (!conflict) return;
		applyAppData(conflict.cloud);
		metadata.revision = conflict.cloudRevision;
		metadata.dirty = false;
		metadata.localUpdatedAt = null;
		persistMetadata();
		baseline = serialize(conflict.cloud);
		pendingSnapshot = null;
		conflict = null;
		status = 'synced';
	},

	async useLocalConflict(): Promise<void> {
		const current = conflict;
		if (!current) return;

		const localSnapshot = collectAppData();
		status = 'saving';
		let response: Response;
		try {
			response = await fetch('/api/progress', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					data: localSnapshot,
					expectedRevision: current.cloudRevision,
				}),
			});
		} catch {
			// keep the dialog open so the choice can be retried
			status = 'conflict';
			return;
		}

		if (response.status === 409) {
			// Another device won the race: show its snapshot as the cloud side.
			const body = await response.json();
			const cloud = parseAppData(body?.data);
			if (cloud) {
				conflict = {
					local: collectAppData(),
					cloud,
					cloudRevision: body.revision,
					cloudUpdatedAt: body.updatedAt,
					localUpdatedAt: metadata.localUpdatedAt,
				};
			}
			status = 'conflict';
			return;
		}

		if (response.status === 401) {
			const session = await authClient.getSession();
			if (!session.data?.user) {
				setUser(null);
				metadata.revision = null;
				persistMetadata();
				conflict = null;
				status = 'local';
				return;
			}
			status = 'conflict';
			return;
		}

		if (!response.ok) {
			status = 'conflict'; // dialog stays; user can retry
			return;
		}

		const body = await response.json();
		metadata.revision = body.revision;
		metadata.dirty = false;
		metadata.localUpdatedAt = Date.now();
		persistMetadata();
		baseline = serialize(localSnapshot);
		pendingSnapshot = null;
		conflict = null;
		status = 'synced';
	},

	// Retry a failed write when the browser comes back online.
	armOnlineRetry(): void {
		if (!browser) return;
		window.addEventListener('online', () => {
			if (metadata.dirty && user && status !== 'conflict' && pendingSnapshot) {
				void flushPending();
			}
		});
	},
};

if (browser) {
	cloudSyncStore.armOnlineRetry();
}
