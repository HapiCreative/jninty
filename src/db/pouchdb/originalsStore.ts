/**
 * Local-only storage for original (full-resolution) photos.
 *
 * Original photos are large (often 3-10 MB) and should NOT be synced via
 * CouchDB replication. This module stores them in a separate PouchDB
 * database that is never replicated, keeping sync fast while still
 * allowing local access to the full-resolution files.
 */
import PouchDB from "pouchdb";

let originalsDB: PouchDB.Database = new PouchDB("jninty-originals");

/**
 * Replace the originals DB instance (for tests).
 */
export function _setOriginalsDB(db: PouchDB.Database): void {
  originalsDB = db;
}

export function getOriginalsDB(): PouchDB.Database {
  return originalsDB;
}

/**
 * Convert a Blob to a format PouchDB can store.
 * In Node.js (tests), PouchDB needs a Buffer.
 */
async function toAttachmentData(blob: Blob | Buffer): Promise<Blob | Buffer> {
  if (typeof Buffer !== "undefined" && blob instanceof Buffer) {
    return blob;
  }
  if (typeof Buffer !== "undefined") {
    if (typeof (blob as Blob).arrayBuffer === "function") {
      try {
        return Buffer.from(await (blob as Blob).arrayBuffer());
      } catch {
        // fall through
      }
    }
    return Buffer.alloc((blob as Blob).size || 0);
  }
  return blob;
}

/**
 * Save an original photo blob, keyed by photo ID.
 */
export async function saveOriginal(
  photoId: string,
  blob: Blob,
): Promise<void> {
  const docId = `original:${photoId}`;

  // Check if doc already exists (upsert)
  let rev: string | undefined;
  try {
    const existing = await originalsDB.get(docId);
    rev = existing._rev;
  } catch {
    // Doc doesn't exist yet — that's fine
  }

  await originalsDB.put({
    _id: docId,
    ...(rev != null ? { _rev: rev } : {}),
    photoId,
    _attachments: {
      original: {
        content_type: blob.type || "image/jpeg",
        data: await toAttachmentData(blob),
      },
    },
  });
}

/**
 * Retrieve the original photo blob by photo ID.
 */
export async function getOriginal(
  photoId: string,
): Promise<Blob | undefined> {
  const docId = `original:${photoId}`;
  try {
    const data = await originalsDB.getAttachment(docId, "original");
    if (!data) return undefined;
    return data instanceof Blob ? data : new Blob([data as Buffer]);
  } catch {
    return undefined;
  }
}

/**
 * Remove the original photo for a given photo ID.
 */
export async function removeOriginal(photoId: string): Promise<void> {
  const docId = `original:${photoId}`;
  try {
    const existing = await originalsDB.get(docId);
    await originalsDB.remove(existing);
  } catch {
    // Already gone or never existed — that's fine
  }
}

/**
 * Remove all stored originals. Used by the "Clear Original Photos" action.
 */
export async function clearAllOriginals(): Promise<void> {
  const result = await originalsDB.allDocs();
  for (const row of result.rows) {
    if (row.id.startsWith("original:")) {
      try {
        const doc = await originalsDB.get(row.id);
        await originalsDB.remove(doc);
      } catch {
        // Skip docs that disappeared between allDocs and get
      }
    }
  }
}

/**
 * Destroy the originals DB and create a fresh, empty instance.
 * Used during full-replace import.
 */
export async function destroyAndRecreateOriginals(): Promise<void> {
  await originalsDB.destroy();
  originalsDB = new PouchDB("jninty-originals");
}

/**
 * Get total size of all stored originals in bytes.
 */
export async function getOriginalsSizeBytes(): Promise<number> {
  let totalBytes = 0;
  const result = await originalsDB.allDocs({ include_docs: true });

  for (const row of result.rows) {
    if (!row.id.startsWith("original:")) continue;
    const doc = row.doc as
      | (PouchDB.Core.IdMeta &
          PouchDB.Core.GetMeta & {
            _attachments?: Record<string, { length?: number }>;
          })
      | undefined;
    const len = doc?._attachments?.["original"]?.length;
    if (typeof len === "number" && !Number.isNaN(len)) {
      totalBytes += len;
    }
  }

  return totalBytes;
}
