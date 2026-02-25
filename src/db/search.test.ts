import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./schema.ts";
import {
  addToIndex,
  removeFromIndex,
  search,
  serializeIndex,
  loadIndex,
  rebuildIndex,
  _resetIndex,
} from "./search.ts";
import type { PlantInstance } from "../validation/plantInstance.schema.ts";
import type { JournalEntry } from "../validation/journalEntry.schema.ts";

beforeEach(async () => {
  await db.delete();
  await db.open();
  // Reset only the in-memory index; don't serialize to DB.
  _resetIndex();
});

const timestamp = new Date().toISOString();

function makePlant(overrides: Partial<PlantInstance> = {}): PlantInstance {
  return {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    species: "Solanum lycopersicum",
    type: "vegetable",
    isPerennial: false,
    source: "seed",
    status: "active",
    tags: ["tomato", "summer"],
    ...overrides,
  };
}

function makeJournal(
  overrides: Partial<JournalEntry> = {},
): JournalEntry {
  return {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    seasonId: "00000000-0000-0000-0000-000000000099",
    activityType: "general",
    body: "Noticed some new growth today.",
    photoIds: [],
    isMilestone: false,
    ...overrides,
  };
}

describe("search", () => {
  describe("addToIndex / search", () => {
    it("indexes a plant and finds it by species", () => {
      const plant = makePlant();
      addToIndex(plant);

      const results = search("Solanum");
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe(plant.id);
      expect(results[0]?.entityType).toBe("plant");
    });

    it("indexes a plant and finds it by nickname", () => {
      const plant = makePlant({ nickname: "Big Boy" });
      addToIndex(plant);

      const results = search("Big Boy");
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe(plant.id);
    });

    it("indexes a plant and finds it by tag", () => {
      const plant = makePlant({ tags: ["heirloom", "organic"] });
      addToIndex(plant);

      const results = search("heirloom");
      expect(results).toHaveLength(1);
    });

    it("indexes a journal entry and finds it by body text", () => {
      const entry = makeJournal({ body: "The basil is wilting badly." });
      addToIndex(entry);

      const results = search("basil wilting");
      expect(results).toHaveLength(1);
      expect(results[0]?.entityType).toBe("journal");
    });

    it("indexes a journal entry and finds it by title", () => {
      const entry = makeJournal({ title: "First harvest report" });
      addToIndex(entry);

      const results = search("harvest report");
      expect(results).toHaveLength(1);
    });

    it("returns empty array for no matches", () => {
      const plant = makePlant();
      addToIndex(plant);

      const results = search("xyznonexistent");
      expect(results).toHaveLength(0);
    });

    it("returns empty array for empty query", () => {
      const plant = makePlant();
      addToIndex(plant);

      expect(search("")).toHaveLength(0);
      expect(search("  ")).toHaveLength(0);
    });

    it("updates an existing document when re-added", () => {
      const plant = makePlant({ nickname: "Alpha Original" });
      addToIndex(plant);

      const updated = { ...plant, nickname: "Bravo Replacement" };
      addToIndex(updated);

      expect(search("Alpha")).toHaveLength(0);
      expect(search("Original")).toHaveLength(0);
      expect(search("Bravo")).toHaveLength(1);
      expect(search("Replacement")).toHaveLength(1);
    });
  });

  describe("removeFromIndex", () => {
    it("removes a document from the index", () => {
      const plant = makePlant();
      addToIndex(plant);
      expect(search("Solanum")).toHaveLength(1);

      removeFromIndex(plant.id);
      expect(search("Solanum")).toHaveLength(0);
    });

    it("is a no-op for non-existent ids", () => {
      // Should not throw
      removeFromIndex("00000000-0000-0000-0000-000000000000");
    });
  });

  describe("serializeIndex / loadIndex", () => {
    it("round-trips the index through IndexedDB", async () => {
      const plant = makePlant({ nickname: "Persisted Plant" });
      addToIndex(plant);

      await serializeIndex();

      // Clear the in-memory index without touching DB
      _resetIndex();
      expect(search("Persisted")).toHaveLength(0);

      // Load from IndexedDB
      const loaded = await loadIndex();
      expect(loaded).toBe(true);

      const results = search("Persisted");
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe(plant.id);
    });

    it("loadIndex returns false when no saved index exists", async () => {
      const loaded = await loadIndex();
      expect(loaded).toBe(false);
    });

    it("addToIndex works after loadIndex without duplicate ID crash", async () => {
      const plant = makePlant({ nickname: "Persisted Alpha" });
      // Store the plant in the DB so loadIndex can rebuild docMap
      await db.plantInstances.add(plant);
      addToIndex(plant);
      await serializeIndex();

      // Simulate app restart: reset in-memory state, then load from DB
      _resetIndex();
      await loadIndex();

      // Updating the same document should NOT throw "duplicate ID"
      const updated = { ...plant, nickname: "Persisted Bravo" };
      addToIndex(updated);

      expect(search("Alpha")).toHaveLength(0);
      expect(search("Bravo")).toHaveLength(1);
    });
  });

  describe("rebuildIndex", () => {
    it("rebuilds from all non-deleted DB records", async () => {
      // Add records directly to DB
      const plant = makePlant();
      const deletedPlant = makePlant({
        deletedAt: timestamp,
        species: "Deleted species",
      });
      const entry = makeJournal();
      const deletedEntry = makeJournal({
        deletedAt: timestamp,
        body: "Deleted entry",
      });

      await db.plantInstances.bulkAdd([plant, deletedPlant]);
      await db.journalEntries.bulkAdd([entry, deletedEntry]);

      const count = await rebuildIndex();
      expect(count).toBe(2); // only non-deleted

      expect(search("Solanum")).toHaveLength(1);
      expect(search("Deleted")).toHaveLength(0);
    });

    it("persists the rebuilt index to IndexedDB", async () => {
      const plant = makePlant({ nickname: "Rebuilt" });
      await db.plantInstances.add(plant);

      await rebuildIndex();

      // Verify it was saved
      const record = await db.searchIndex.get("main");
      expect(record).toBeDefined();
      expect(record?.data).toBeTruthy();
    });
  });

  describe("search ranking", () => {
    it("ranks nickname matches higher than body matches", () => {
      const plantWithNickname = makePlant({ nickname: "Basil King" });
      const entryWithBody = makeJournal({
        body: "I found some basil growing.",
      });
      addToIndex(plantWithNickname);
      addToIndex(entryWithBody);

      const results = search("basil");
      expect(results).toHaveLength(2);
      // Plant (nickname boosted) should rank first
      expect(results[0]?.id).toBe(plantWithNickname.id);
    });
  });
});
