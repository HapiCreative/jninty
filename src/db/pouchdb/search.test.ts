import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import PouchDB from "pouchdb";
import PouchDBFind from "pouchdb-find";
import PouchDBAdapterMemory from "pouchdb-adapter-memory";

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(PouchDBAdapterMemory);

// Mock the client module to use an in-memory PouchDB for tests
let testDB: PouchDB.Database;

vi.mock("./client.ts", () => ({
  get localDB() {
    return testDB;
  },
}));

// Import after mock setup
const searchModule = await import("./search.ts");

import type { PlantInstance } from "../../validation/plantInstance.schema.ts";
import type { JournalEntry } from "../../validation/journalEntry.schema.ts";

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

function makeJournal(overrides: Partial<JournalEntry> = {}): JournalEntry {
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

/** Put a plant doc into PouchDB in the same format repositories use. */
async function putPlantDoc(plant: PlantInstance): Promise<void> {
  await testDB.put({
    _id: `plant:${plant.id}`,
    docType: "plant",
    ...plant,
  });
}

/** Put a journal doc into PouchDB in the same format repositories use. */
async function putJournalDoc(entry: JournalEntry): Promise<void> {
  await testDB.put({
    _id: `journal:${entry.id}`,
    docType: "journal",
    ...entry,
  });
}

beforeEach(async () => {
  testDB = new PouchDB(`test-search-${crypto.randomUUID()}`, {
    adapter: "memory",
  });
  searchModule._resetIndex();
});

afterEach(() => {
  searchModule._resetIndex();
});

describe("PouchDB search", () => {
  describe("addToIndex / search", () => {
    it("indexes a plant and finds it by species", () => {
      const plant = makePlant();
      searchModule.addToIndex(plant, "plant");

      const results = searchModule.search("Solanum");
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe(plant.id);
      expect(results[0]?.entityType).toBe("plant");
    });

    it("indexes a plant and finds it by nickname", () => {
      const plant = makePlant({ nickname: "Big Boy" });
      searchModule.addToIndex(plant, "plant");

      const results = searchModule.search("Big Boy");
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe(plant.id);
    });

    it("indexes a journal entry and finds it by body text", () => {
      const entry = makeJournal({ body: "The basil is wilting badly." });
      searchModule.addToIndex(entry, "journal");

      const results = searchModule.search("basil wilting");
      expect(results).toHaveLength(1);
      expect(results[0]?.entityType).toBe("journal");
    });

    it("indexes a journal entry and finds it by title", () => {
      const entry = makeJournal({ title: "First harvest report" });
      searchModule.addToIndex(entry, "journal");

      const results = searchModule.search("harvest report");
      expect(results).toHaveLength(1);
    });

    it("returns empty array for no matches", () => {
      searchModule.addToIndex(makePlant(), "plant");
      expect(searchModule.search("xyznonexistent")).toHaveLength(0);
    });

    it("returns empty array for empty query", () => {
      searchModule.addToIndex(makePlant(), "plant");
      expect(searchModule.search("")).toHaveLength(0);
      expect(searchModule.search("  ")).toHaveLength(0);
    });

    it("updates an existing document when re-added", () => {
      const plant = makePlant({ nickname: "Alpha Original" });
      searchModule.addToIndex(plant, "plant");

      const updated = { ...plant, nickname: "Bravo Replacement" };
      searchModule.addToIndex(updated, "plant");

      expect(searchModule.search("Alpha")).toHaveLength(0);
      expect(searchModule.search("Bravo")).toHaveLength(1);
    });
  });

  describe("removeFromIndex", () => {
    it("removes a document from the index", () => {
      const plant = makePlant();
      searchModule.addToIndex(plant, "plant");
      expect(searchModule.search("Solanum")).toHaveLength(1);

      searchModule.removeFromIndex(plant.id);
      expect(searchModule.search("Solanum")).toHaveLength(0);
    });

    it("is a no-op for non-existent ids", () => {
      searchModule.removeFromIndex("00000000-0000-0000-0000-000000000000");
    });
  });

  describe("rebuildIndex", () => {
    it("rebuilds from all non-deleted PouchDB docs", async () => {
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

      await putPlantDoc(plant);
      await putPlantDoc(deletedPlant);
      await putJournalDoc(entry);
      await putJournalDoc(deletedEntry);

      const count = await searchModule.rebuildIndex();
      expect(count).toBe(2);

      expect(searchModule.search("Solanum")).toHaveLength(1);
      expect(searchModule.search("Deleted")).toHaveLength(0);
    });

    it("ignores non-plant/journal doc types", async () => {
      await testDB.put({
        _id: "task:some-task",
        docType: "task",
        id: "some-task",
        title: "Water the garden",
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await putPlantDoc(makePlant());

      const count = await searchModule.rebuildIndex();
      expect(count).toBe(1);
    });

    it("clears previous index state before rebuilding", async () => {
      // Add a plant to the index manually
      searchModule.addToIndex(makePlant({ nickname: "Old Manual" }), "plant");
      expect(searchModule.search("Manual")).toHaveLength(1);

      // Rebuild with an empty DB — the manual entry should be gone
      const count = await searchModule.rebuildIndex();
      expect(count).toBe(0);
      expect(searchModule.search("Manual")).toHaveLength(0);
    });
  });

  describe("handleChange (changes feed)", () => {
    it("indexes a new plant document from a change event", () => {
      const plant = makePlant({ nickname: "Synced Tomato" });

      searchModule.handleChange({
        id: `plant:${plant.id}`,
        seq: 1,
        changes: [{ rev: "1-abc" }],
        doc: {
          _id: `plant:${plant.id}`,
          _rev: "1-abc",
          docType: "plant",
          ...plant,
        } as unknown as PouchDB.Core.ExistingDocument<object>,
      });

      const results = searchModule.search("Synced Tomato");
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe(plant.id);
    });

    it("indexes a new journal document from a change event", () => {
      const entry = makeJournal({ body: "Peppers are flowering from sync" });

      searchModule.handleChange({
        id: `journal:${entry.id}`,
        seq: 2,
        changes: [{ rev: "1-def" }],
        doc: {
          _id: `journal:${entry.id}`,
          _rev: "1-def",
          docType: "journal",
          ...entry,
        } as unknown as PouchDB.Core.ExistingDocument<object>,
      });

      const results = searchModule.search("Peppers flowering");
      expect(results).toHaveLength(1);
      expect(results[0]?.entityType).toBe("journal");
    });

    it("updates the index when a document is modified", () => {
      const plant = makePlant({ nickname: "Before Update" });
      searchModule.addToIndex(plant, "plant");

      searchModule.handleChange({
        id: `plant:${plant.id}`,
        seq: 3,
        changes: [{ rev: "2-ghi" }],
        doc: {
          _id: `plant:${plant.id}`,
          _rev: "2-ghi",
          docType: "plant",
          ...plant,
          nickname: "After Update",
        } as unknown as PouchDB.Core.ExistingDocument<object>,
      });

      expect(searchModule.search("Before")).toHaveLength(0);
      expect(searchModule.search("After Update")).toHaveLength(1);
    });

    it("removes from index when a document is hard-deleted", () => {
      const plant = makePlant();
      searchModule.addToIndex(plant, "plant");
      expect(searchModule.search("Solanum")).toHaveLength(1);

      searchModule.handleChange({
        id: `plant:${plant.id}`,
        seq: 4,
        changes: [{ rev: "3-jkl" }],
        deleted: true,
      });

      expect(searchModule.search("Solanum")).toHaveLength(0);
    });

    it("removes from index when a document is soft-deleted", () => {
      const plant = makePlant({ nickname: "Soon Deleted" });
      searchModule.addToIndex(plant, "plant");
      expect(searchModule.search("Soon Deleted")).toHaveLength(1);

      searchModule.handleChange({
        id: `plant:${plant.id}`,
        seq: 5,
        changes: [{ rev: "2-mno" }],
        doc: {
          _id: `plant:${plant.id}`,
          _rev: "2-mno",
          docType: "plant",
          ...plant,
          deletedAt: new Date().toISOString(),
        } as unknown as PouchDB.Core.ExistingDocument<object>,
      });

      expect(searchModule.search("Soon Deleted")).toHaveLength(0);
    });

    it("ignores changes for non-searchable doc types", () => {
      searchModule.handleChange({
        id: "task:some-task",
        seq: 6,
        changes: [{ rev: "1-pqr" }],
        doc: {
          _id: "task:some-task",
          _rev: "1-pqr",
          docType: "task",
          id: "some-task",
          title: "Water plants",
        } as unknown as PouchDB.Core.ExistingDocument<object>,
      });

      expect(searchModule.search("Water plants")).toHaveLength(0);
    });

    it("ignores changes without a doc attached", () => {
      // Should not throw
      searchModule.handleChange({
        id: "plant:no-doc",
        seq: 7,
        changes: [{ rev: "1-stu" }],
      });
    });
  });

  describe("startListening / stopListening (live changes)", () => {
    it("auto-indexes documents written after listening starts", async () => {
      await searchModule.rebuildIndex();
      searchModule.startListening();

      const plant = makePlant({ nickname: "Live Listener" });
      await putPlantDoc(plant);

      // Changes feed is async — wait for it to fire
      await new Promise((resolve) => setTimeout(resolve, 200));

      const results = searchModule.search("Live Listener");
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe(plant.id);
    });

    it("auto-removes documents deleted after listening starts", async () => {
      const plant = makePlant({ nickname: "Will Be Deleted" });
      await putPlantDoc(plant);
      await searchModule.rebuildIndex();
      expect(searchModule.search("Will Be Deleted")).toHaveLength(1);

      searchModule.startListening();

      // Soft-delete via PouchDB update
      const doc = await testDB.get(`plant:${plant.id}`);
      await testDB.put({
        ...doc,
        deletedAt: new Date().toISOString(),
        version: 2,
        updatedAt: new Date().toISOString(),
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(searchModule.search("Will Be Deleted")).toHaveLength(0);
    });

    it("stopListening prevents further index updates", async () => {
      searchModule.startListening();
      searchModule.stopListening();

      const plant = makePlant({ nickname: "After Stop" });
      await putPlantDoc(plant);

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(searchModule.search("After Stop")).toHaveLength(0);
    });
  });

  describe("search ranking", () => {
    it("ranks nickname matches higher than body matches", () => {
      const plantWithNickname = makePlant({ nickname: "Basil King" });
      const entryWithBody = makeJournal({
        body: "I found some basil growing.",
      });
      searchModule.addToIndex(plantWithNickname, "plant");
      searchModule.addToIndex(entryWithBody, "journal");

      const results = searchModule.search("basil");
      expect(results).toHaveLength(2);
      expect(results[0]?.id).toBe(plantWithNickname.id);
    });
  });
});
