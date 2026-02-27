import PouchDB from "pouchdb";
import PouchDBFind from "pouchdb-find";
import PouchDBAdapterIndexedDB from "pouchdb-adapter-indexeddb";

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(PouchDBAdapterIndexedDB);

export const localDB = new PouchDB("jninty", { adapter: "indexeddb" });

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
