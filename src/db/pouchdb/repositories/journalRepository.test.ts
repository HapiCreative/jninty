import { describe, it, expect, beforeEach, vi } from "vitest";
import PouchDB from "pouchdb";
import PouchDBFind from "pouchdb-find";
import PouchDBAdapterMemory from "pouchdb-adapter-memory";

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(PouchDBAdapterMemory);

let testDB: PouchDB.Database;

vi.mock("../client.ts", () => ({
  get localDB() {
    return testDB;
  },
}));

const journalRepo = await import("./journalRepository.ts");

const SEASON_1 = crypto.randomUUID();
const SEASON_2 = crypto.randomUUID();
const PLANT_1 = crypto.randomUUID();
const PLANT_2 = crypto.randomUUID();

const baseJournal = {
  seasonId: SEASON_1,
  activityType: "watering" as const,
  body: "Watered the tomatoes",
  photoIds: [] as string[],
  isMilestone: false,
};

beforeEach(async () => {
  testDB = new PouchDB(`test-journal-${crypto.randomUUID()}`, {
    adapter: "memory",
  });
});

describe("PouchDB journalRepository", () => {
  describe("create", () => {
    it("creates a journal entry with auto-generated fields", async () => {
      const entry = await journalRepo.create(baseJournal);

      expect(entry.id).toBeDefined();
      expect(entry.version).toBe(1);
      expect(entry.body).toBe("Watered the tomatoes");
      expect(entry.deletedAt).toBeUndefined();
    });
  });

  describe("update", () => {
    it("increments version and updates body", async () => {
      const entry = await journalRepo.create(baseJournal);
      const updated = await journalRepo.update(entry.id, {
        body: "Updated notes",
      });

      expect(updated.version).toBe(2);
      expect(updated.body).toBe("Updated notes");
      expect(updated.createdAt).toBe(entry.createdAt);
    });

    it("throws for soft-deleted entry", async () => {
      const entry = await journalRepo.create(baseJournal);
      await journalRepo.softDelete(entry.id);

      await expect(
        journalRepo.update(entry.id, { body: "Nope" }),
      ).rejects.toThrow("JournalEntry not found");
    });
  });

  describe("softDelete", () => {
    it("soft deletes and hides from getById", async () => {
      const entry = await journalRepo.create(baseJournal);
      await journalRepo.softDelete(entry.id);

      const found = await journalRepo.getById(entry.id);
      expect(found).toBeUndefined();
    });
  });

  describe("getByPlantId", () => {
    it("returns entries for a specific plant", async () => {
      await journalRepo.create({
        ...baseJournal,
        plantInstanceId: PLANT_1,
      });
      await journalRepo.create({
        ...baseJournal,
        plantInstanceId: PLANT_2,
      });

      const entries = await journalRepo.getByPlantId(PLANT_1);
      expect(entries).toHaveLength(1);
    });
  });

  describe("getByActivityType", () => {
    it("filters by activity type", async () => {
      await journalRepo.create(baseJournal);
      await journalRepo.create({
        ...baseJournal,
        activityType: "pruning",
        body: "Pruned the roses",
      });

      const watering = await journalRepo.getByActivityType("watering");
      expect(watering).toHaveLength(1);
      expect(watering[0]?.body).toBe("Watered the tomatoes");
    });
  });

  describe("getRecent", () => {
    it("returns limited recent entries", async () => {
      for (let i = 0; i < 5; i++) {
        await journalRepo.create({
          ...baseJournal,
          body: `Entry ${String(i)}`,
        });
      }

      const recent = await journalRepo.getRecent(3);
      expect(recent).toHaveLength(3);
    });
  });

  describe("getBySeasonId", () => {
    it("filters by season", async () => {
      await journalRepo.create(baseJournal);
      await journalRepo.create({
        ...baseJournal,
        seasonId: SEASON_2,
        body: "Different season",
      });

      const entries = await journalRepo.getBySeasonId(SEASON_1);
      expect(entries).toHaveLength(1);
    });
  });

  describe("getByDateRange", () => {
    it("returns entries within date range", async () => {
      const entry = await journalRepo.create(baseJournal);

      const start = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();
      const end = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const results = await journalRepo.getByDateRange(start, end);
      expect(results.some((r) => r.id === entry.id)).toBe(true);
    });
  });
});
