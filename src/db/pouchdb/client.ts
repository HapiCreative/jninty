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

type SyncStatus = "syncing" | "paused" | "error" | "offline" | "disabled";

let activeSyncHandler: PouchDB.Replication.Sync<object> | null = null;
let currentSyncStatus: SyncStatus = "disabled";

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
  });

  sync.on("paused", () => {
    currentSyncStatus = "paused";
  });

  sync.on("active", () => {
    currentSyncStatus = "syncing";
  });

  sync.on("error", () => {
    currentSyncStatus = "error";
  });

  activeSyncHandler = sync;
  currentSyncStatus = "syncing";

  return sync;
}

export function stopSync(): void {
  if (activeSyncHandler) {
    activeSyncHandler.cancel();
    activeSyncHandler = null;
  }
  currentSyncStatus = "disabled";
}

export function getSyncStatus(): SyncStatus {
  return currentSyncStatus;
}
