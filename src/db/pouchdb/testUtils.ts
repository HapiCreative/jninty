import { resetLocalDB } from "./client.ts";

/**
 * Reset PouchDB for test isolation.
 * Creates a fresh, uniquely-named database to avoid stale PouchDB-Find
 * views that occur with fake-indexeddb when docs are bulk-deleted.
 */
export async function clearPouchDB(): Promise<void> {
  resetLocalDB();
}
