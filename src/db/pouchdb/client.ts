import PouchDB from "pouchdb";
import PouchDBFind from "pouchdb-find";
import PouchDBAdapterIndexedDB from "pouchdb-adapter-indexeddb";

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(PouchDBAdapterIndexedDB);

import { resetIndexState } from "./indexes.ts";

let dbCounter = 0;

function createLocalDB(name = "jninty") {
  return new PouchDB(name, { adapter: "indexeddb" });
}

export let localDB = createLocalDB();

/**
 * Replace the local PouchDB instance with a fresh, empty one.
 * For use in test cleanup — avoids stale PouchDB-Find views
 * that happen when docs are bulk-deleted via allDocs in fake-indexeddb.
 * Each call creates a uniquely-named DB to guarantee a clean slate.
 */
export function resetLocalDB(): void {
  dbCounter++;
  localDB = createLocalDB(`jninty-test-${dbCounter}`);
  resetIndexState();
}

export type SyncStatus = "syncing" | "paused" | "error" | "offline" | "disabled";

let activeSyncHandler: PouchDB.Replication.Sync<object> | null = null;
let currentSyncStatus: SyncStatus = "disabled";
let lastSyncedAt: string | null = null;

// ─── Subscriber pattern for useSyncExternalStore ───

const syncStatusListeners = new Set<() => void>();

function notifySyncStatusListeners() {
  for (const listener of syncStatusListeners) {
    listener();
  }
}

export function subscribeSyncStatus(listener: () => void): () => void {
  syncStatusListeners.add(listener);
  return () => {
    syncStatusListeners.delete(listener);
  };
}

export function getLastSyncedAt(): string | null {
  return lastSyncedAt;
}

export async function testConnection(
  url: string,
  credentials?: { username: string; password: string },
): Promise<{ dbName: string; docCount: number; diskSize: number }> {
  const opts: PouchDB.Configuration.RemoteDatabaseConfiguration = {};
  if (credentials) {
    opts.auth = { username: credentials.username, password: credentials.password };
  }
  const tempDB = new PouchDB(url, opts);
  try {
    const info = await tempDB.info();
    return {
      dbName: info.db_name,
      docCount: info.doc_count,
      diskSize: ((info as unknown as Record<string, unknown>)["disk_size"] as number) ?? 0,
    };
  } finally {
    await tempDB.close();
  }
}

export type RemoteDBInfo = {
  dbName: string;
  docCount: number;
  diskSize: number;
};

/**
 * Query the remote CouchDB for database info (doc count, disk size).
 * Returns null if sync is not configured or the remote is unreachable.
 */
export async function getRemoteInfo(
  url: string,
  credentials?: { username: string; password: string },
): Promise<RemoteDBInfo | null> {
  const opts: PouchDB.Configuration.RemoteDatabaseConfiguration = {};
  if (credentials) {
    opts.auth = { username: credentials.username, password: credentials.password };
  }
  const tempDB = new PouchDB(url, opts);
  try {
    const info = await tempDB.info();
    return {
      dbName: info.db_name,
      docCount: info.doc_count,
      diskSize:
        ((info as unknown as Record<string, unknown>)["disk_size"] as number) ??
        ((info as unknown as Record<string, unknown>)["data_size"] as number) ??
        0,
    };
  } catch {
    return null;
  } finally {
    await tempDB.close();
  }
}

// ─── Sync lifecycle ───

export function setupSync(
  remoteUrl: string,
  credentials?: { username: string; password: string },
): PouchDB.Replication.Sync<object> {
  if (activeSyncHandler) {
    activeSyncHandler.cancel();
  }

  const remoteOptions: PouchDB.Configuration.RemoteDatabaseConfiguration = {};
  if (credentials) {
    remoteOptions.auth = {
      username: credentials.username,
      password: credentials.password,
    };
  }

  const remoteDB = new PouchDB(remoteUrl, remoteOptions);

  const sync = localDB.sync(remoteDB, { live: true, retry: true });

  sync.on("change", () => {
    currentSyncStatus = "syncing";
    notifySyncStatusListeners();
  });

  sync.on("paused", () => {
    currentSyncStatus = "paused";
    lastSyncedAt = new Date().toISOString();
    notifySyncStatusListeners();
  });

  sync.on("active", () => {
    currentSyncStatus = "syncing";
    notifySyncStatusListeners();
  });

  sync.on("error", () => {
    currentSyncStatus = "error";
    notifySyncStatusListeners();
  });

  activeSyncHandler = sync;
  currentSyncStatus = "syncing";
  notifySyncStatusListeners();

  return sync;
}

export function stopSync(): void {
  if (activeSyncHandler) {
    activeSyncHandler.cancel();
    activeSyncHandler = null;
  }
  currentSyncStatus = "disabled";
  notifySyncStatusListeners();
}

export function getSyncStatus(): SyncStatus {
  return currentSyncStatus;
}

/**
 * Destroy the local PouchDB and create a fresh, empty instance.
 * Used during full-replace import to start from a clean slate.
 * Cancels active sync and resets index state.
 */
export async function destroyAndRecreate(): Promise<void> {
  if (activeSyncHandler) {
    activeSyncHandler.cancel();
    activeSyncHandler = null;
  }
  currentSyncStatus = "disabled";
  notifySyncStatusListeners();

  await localDB.destroy();
  localDB = createLocalDB();
  resetIndexState();
}
