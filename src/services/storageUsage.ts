import { localDB } from "../db/pouchdb/client.ts";
import { getOriginalsSizeBytes } from "../db/pouchdb/originalsStore.ts";

export type StorageUsage = {
  thumbnailBytes: number;
  displayBytes: number;
  originalBytes: number;
  dataBytes: number;
  totalBytes: number;
  quotaBytes: number;
};

export async function getStorageUsage(): Promise<StorageUsage> {
  let thumbnailBytes = 0;
  let displayBytes = 0;

  // Fetch all photo docs with attachment stub metadata (includes length)
  const result = await localDB.allDocs({
    startkey: "photo:",
    endkey: "photo:\uffff",
    include_docs: true,
  });

  for (const row of result.rows) {
    const doc = row.doc as
      | (PouchDB.Core.IdMeta &
          PouchDB.Core.GetMeta & {
            _attachments?: Record<
              string,
              { length?: number; stub?: boolean }
            >;
          })
      | undefined;

    const attachments = doc?._attachments;
    if (!attachments) continue;

    const thumbLen = attachments["thumbnail"]?.length;
    if (typeof thumbLen === "number" && !Number.isNaN(thumbLen)) {
      thumbnailBytes += thumbLen;
    }

    const dispLen = attachments["display"]?.length;
    if (typeof dispLen === "number" && !Number.isNaN(dispLen)) {
      displayBytes += dispLen;
    }
  }

  // Originals are in a separate local-only DB (not synced)
  const originalBytes = await getOriginalsSizeBytes();

  // Use Storage API estimate when available
  let totalBytes = 0;
  let quotaBytes = 0;
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    totalBytes = estimate.usage ?? 0;
    quotaBytes = estimate.quota ?? 0;
  }

  const photosTotal = thumbnailBytes + displayBytes + originalBytes;
  if (totalBytes < photosTotal) {
    totalBytes = photosTotal;
  }
  const dataBytes = Math.max(0, totalBytes - photosTotal);

  return { thumbnailBytes, displayBytes, originalBytes, dataBytes, totalBytes, quotaBytes };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
