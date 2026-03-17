import PouchDB from "pouchdb";
import { localDB } from "../db/pouchdb/client";
import { apiUrl } from "../config/cloud";

export type CloudSyncStatus = "idle" | "syncing" | "paused" | "error";

let syncHandler: PouchDB.Replication.Sync<object> | null = null;
let currentStatus: CloudSyncStatus = "idle";
const listeners = new Set<(status: CloudSyncStatus) => void>();

function setStatus(status: CloudSyncStatus) {
  currentStatus = status;
  for (const listener of listeners) {
    listener(status);
  }
}

export function startCloudSync(userId: string): void {
  if (syncHandler) {
    syncHandler.cancel();
  }

  if (!apiUrl) return;

  const remoteUrl = `${apiUrl}/couchdb/${userId}`;
  const remoteDB = new PouchDB(remoteUrl, {
    skip_setup: true,
    fetch(url, opts) {
      const fetchOpts = opts ?? {};
      // Auth token is sent automatically via HttpOnly cookie
      return fetch(url, { ...fetchOpts, credentials: "include" });
    },
  } as PouchDB.Configuration.RemoteDatabaseConfiguration);

  const sync = localDB.sync(remoteDB, { live: true, retry: true });

  sync.on("change", () => setStatus("syncing"));
  sync.on("active", () => setStatus("syncing"));
  sync.on("paused", () => setStatus("paused"));
  sync.on("error", () => setStatus("error"));
  sync.on("complete", () => setStatus("idle"));

  syncHandler = sync;
  setStatus("syncing");
}

export function stopCloudSync(): void {
  if (syncHandler) {
    syncHandler.cancel();
    syncHandler = null;
  }
  setStatus("idle");
}

export function getCloudSyncStatus(): CloudSyncStatus {
  return currentStatus;
}

export function onCloudSyncStatusChange(
  listener: (status: CloudSyncStatus) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
