import MiniSearch, { type SearchResult } from "minisearch";
import { localDB } from "./client.ts";
import { stripPouchFields, type PouchDoc } from "./utils.ts";
import type { PlantInstance } from "../../validation/plantInstance.schema.ts";
import type { JournalEntry } from "../../validation/journalEntry.schema.ts";

// ─── Types ───

type EntityType = "plant" | "journal";

type SearchDocument = {
  id: string;
  entityType: EntityType;
  title: string;
  body: string;
  species: string;
  variety: string;
  nickname: string;
  tags: string;
  activityType: string;
};

export type SearchHit = {
  id: string;
  entityType: EntityType;
  score: number;
  match: Record<string, string[]>;
};

// ─── Index singleton ───

const SEARCH_FIELDS = [
  "title",
  "body",
  "species",
  "variety",
  "nickname",
  "tags",
  "activityType",
] as const;

const STORE_FIELDS = ["entityType"] as const;

function createMiniSearch(): MiniSearch<SearchDocument> {
  return new MiniSearch<SearchDocument>({
    fields: [...SEARCH_FIELDS],
    storeFields: [...STORE_FIELDS],
    searchOptions: {
      boost: { nickname: 2, species: 2, title: 1.5 },
      fuzzy: 0.2,
      prefix: true,
    },
  });
}

let index: MiniSearch<SearchDocument> = createMiniSearch();

// Track indexed documents so we can use remove() (which fully cleans up
// term references) instead of discard() (which leaves stale terms).
let docMap = new Map<string, SearchDocument>();

let changesListener: ReturnType<typeof localDB.changes> | null = null;

// ─── Document converters ───

function plantToDocument(plant: PlantInstance): SearchDocument {
  return {
    id: plant.id,
    entityType: "plant",
    title: "",
    body: "",
    species: plant.species,
    variety: plant.variety ?? "",
    nickname: plant.nickname ?? "",
    tags: plant.tags.join(" "),
    activityType: "",
  };
}

function journalToDocument(entry: JournalEntry): SearchDocument {
  return {
    id: entry.id,
    entityType: "journal",
    title: entry.title ?? "",
    body: entry.body,
    species: "",
    variety: "",
    nickname: "",
    tags: "",
    activityType: entry.activityType,
  };
}

// ─── Internal helpers ───

function addOrUpdateDocument(doc: SearchDocument): void {
  const existing = docMap.get(doc.id);
  if (existing) {
    index.remove(existing);
  }
  index.add(doc);
  docMap.set(doc.id, doc);
}

function removeDocument(id: string): void {
  const existing = docMap.get(id);
  if (existing) {
    index.remove(existing);
    docMap.delete(id);
  }
}

/**
 * Process a PouchDB change event and update the search index accordingly.
 * Exported for testing — not part of the primary public API.
 */
export function handleChange(change: PouchDB.Core.ChangesResponseChange<object>): void {
  if (change.deleted) {
    // change.id is the PouchDB _id ("plant:uuid") — extract the entity id
    const colonIdx = change.id.indexOf(":");
    const entityId = colonIdx >= 0 ? change.id.slice(colonIdx + 1) : change.id;
    removeDocument(entityId);
    return;
  }

  const raw = change.doc;
  if (!raw) return;

  const docType = (raw as Record<string, unknown>)["docType"] as string | undefined;
  if (!docType) return;

  // Extract the entity ID from the PouchDB _id ("plant:uuid" → "uuid")
  const entity = stripPouchFields(raw as PouchDoc<Record<string, unknown>>);
  const entityId = (entity as Record<string, unknown>)["id"] as string | undefined;
  if (!entityId) return;

  // Handle soft-deleted documents — remove from index
  const deletedAt = (entity as Record<string, unknown>)["deletedAt"];
  if (deletedAt != null) {
    removeDocument(entityId);
    return;
  }

  if (docType === "plant") {
    addOrUpdateDocument(plantToDocument(entity as unknown as PlantInstance));
  } else if (docType === "journal") {
    addOrUpdateDocument(journalToDocument(entity as unknown as JournalEntry));
  }
}

// ─── Public API ───

export function addToIndex(entity: PlantInstance | JournalEntry): void {
  const doc =
    "species" in entity ? plantToDocument(entity) : journalToDocument(entity);
  addOrUpdateDocument(doc);
}

export function removeFromIndex(id: string): void {
  removeDocument(id);
}

export function search(query: string): SearchHit[] {
  if (!query.trim()) return [];

  const results: SearchResult[] = index.search(query);
  return results.map((r) => ({
    id: r.id as string,
    entityType: (r as unknown as { entityType: EntityType }).entityType,
    score: r.score,
    match: r.match,
  }));
}

/**
 * Rebuild the entire search index from all PouchDB documents.
 * Called on app startup and when the index may be stale.
 */
export async function rebuildIndex(): Promise<number> {
  index = createMiniSearch();
  docMap = new Map();

  const result = await localDB.allDocs({ include_docs: true });

  let count = 0;
  for (const row of result.rows) {
    const raw = row.doc;
    if (!raw) continue;

    const docType = (raw as unknown as Record<string, unknown>)["docType"] as string | undefined;
    if (docType !== "plant" && docType !== "journal") continue;

    const entity = stripPouchFields(raw as PouchDoc<Record<string, unknown>>);
    const deletedAt = (entity as Record<string, unknown>)["deletedAt"];
    if (deletedAt != null) continue;

    if (docType === "plant") {
      addOrUpdateDocument(plantToDocument(entity as unknown as PlantInstance));
    } else {
      addOrUpdateDocument(journalToDocument(entity as unknown as JournalEntry));
    }
    count++;
  }

  return count;
}

/**
 * Start listening to PouchDB changes feed for live index updates.
 * Changes from local writes and incoming sync are both captured.
 */
export function startListening(): void {
  stopListening();

  changesListener = localDB
    .changes({
      live: true,
      since: "now",
      include_docs: true,
    })
    .on("change", handleChange);
}

/**
 * Stop listening to PouchDB changes feed.
 */
export function stopListening(): void {
  if (changesListener) {
    changesListener.cancel();
    changesListener = null;
  }
}

/**
 * No-op for backward compatibility.
 * With PouchDB, the search index is rebuilt from allDocs on startup
 * and kept up-to-date via the changes feed — no serialization needed.
 */
export async function serializeIndex(): Promise<void> {
  // no-op
}

/**
 * No-op for backward compatibility.
 * With PouchDB, the index is rebuilt from allDocs on startup — there is no
 * serialized index to load. Always returns false so callers fall through
 * to rebuildIndex().
 */
export async function loadIndex(): Promise<boolean> {
  return false;
}

/** Reset the in-memory index and stop the changes listener. For testing. */
export function _resetIndex(): void {
  stopListening();
  index = createMiniSearch();
  docMap = new Map();
}
