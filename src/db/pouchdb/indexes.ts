import { localDB } from "./client.ts";

/**
 * Shared index initialization for all PouchDB-Find queries.
 *
 * IMPORTANT: Only ONE index is created. PouchDB-Find + fake-indexeddb
 * has a bug where having >1 _design/ doc causes find() to
 * return empty results. Since all queries filter by `docType` first and do
 * additional filtering in JavaScript, a single `["docType"]` index is sufficient.
 *
 * Additional compound indexes (e.g. ["docType", "dueDate"]) can be added once
 * the project moves to a real IndexedDB or CouchDB backend where this bug
 * doesn't apply.
 */

let indexPromise: Promise<void> | null = null;

export function ensureAllIndexes(): Promise<void> {
  if (!indexPromise) {
    indexPromise = localDB.createIndex({
      index: { fields: ["docType"] },
    }).then(() => undefined);
  }
  return indexPromise;
}

export function resetIndexState(): void {
  indexPromise = null;
}
