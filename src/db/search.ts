import MiniSearch, { type SearchResult } from "minisearch";
import { db } from "./schema.ts";
import type { PlantInstance } from "../validation/plantInstance.schema.ts";
import type { JournalEntry } from "../validation/journalEntry.schema.ts";

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

const SEARCH_INDEX_ID = "main";

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

// ─── Public API ───

export function addToIndex(
  entity: PlantInstance | JournalEntry,
): void {
  const doc =
    "species" in entity ? plantToDocument(entity) : journalToDocument(entity);

  const existing = docMap.get(doc.id);
  if (existing) {
    index.remove(existing);
  }
  index.add(doc);
  docMap.set(doc.id, doc);
}

export function removeFromIndex(id: string): void {
  const existing = docMap.get(id);
  if (existing) {
    index.remove(existing);
    docMap.delete(id);
  }
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

export async function serializeIndex(): Promise<void> {
  const data = JSON.stringify(index.toJSON());
  await db.searchIndex.put({ id: SEARCH_INDEX_ID, data });
}

export async function loadIndex(): Promise<boolean> {
  const record = await db.searchIndex.get(SEARCH_INDEX_ID);
  if (!record) return false;

  index = MiniSearch.loadJSON<SearchDocument>(record.data, {
    fields: [...SEARCH_FIELDS],
    storeFields: [...STORE_FIELDS],
  });

  // Rebuild docMap from DB so addToIndex/removeFromIndex work after load.
  // Without this, the first addToIndex for an existing doc would throw
  // "duplicate ID" because docMap wouldn't know to call remove() first.
  docMap = new Map();
  const plants = await db.plantInstances.toArray();
  for (const plant of plants) {
    if (plant.deletedAt == null) {
      docMap.set(plant.id, plantToDocument(plant));
    }
  }
  const entries = await db.journalEntries.toArray();
  for (const entry of entries) {
    if (entry.deletedAt == null) {
      docMap.set(entry.id, journalToDocument(entry));
    }
  }

  return true;
}

export async function rebuildIndex(): Promise<number> {
  index = createMiniSearch();
  docMap = new Map();

  const plants = await db.plantInstances.toArray();
  const entries = await db.journalEntries.toArray();

  let count = 0;
  for (const plant of plants) {
    if (plant.deletedAt == null) {
      const doc = plantToDocument(plant);
      index.add(doc);
      docMap.set(doc.id, doc);
      count++;
    }
  }
  for (const entry of entries) {
    if (entry.deletedAt == null) {
      const doc = journalToDocument(entry);
      index.add(doc);
      docMap.set(doc.id, doc);
      count++;
    }
  }

  await serializeIndex();
  return count;
}

/** Reset the in-memory index without touching IndexedDB. For testing. */
export function _resetIndex(): void {
  index = createMiniSearch();
  docMap = new Map();
}
