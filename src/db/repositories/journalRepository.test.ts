import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../schema.ts";
import * as journalRepo from "./journalRepository.ts";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const baseEntry = {
  activityType: "general" as const,
  seasonId: "00000000-0000-0000-0000-000000000099",
  body: "Noticed some new growth on the tomato.",
  photoIds: [] as string[],
  isMilestone: false,
};

describe("journalRepository", () => {
  describe("create", () => {
    it("creates an entry with auto-generated fields", async () => {
      const entry = await journalRepo.create(baseEntry);

      expect(entry.id).toBeDefined();
      expect(entry.version).toBe(1);
      expect(entry.createdAt).toBeDefined();
      expect(entry.body).toBe(baseEntry.body);
    });

    it("creates an entry with optional fields", async () => {
      const entry = await journalRepo.create({
        ...baseEntry,
        title: "Growth update",
        plantInstanceId: "00000000-0000-0000-0000-000000000001",
        activityType: "milestone",
        milestoneType: "first_sprout",
        isMilestone: true,
      });

      expect(entry.title).toBe("Growth update");
      expect(entry.milestoneType).toBe("first_sprout");
    });
  });

  describe("update", () => {
    it("increments version and updates timestamp", async () => {
      const entry = await journalRepo.create(baseEntry);
      const updated = await journalRepo.update(entry.id, {
        body: "Updated observation.",
      });

      expect(updated.version).toBe(2);
      expect(updated.body).toBe("Updated observation.");
      expect(updated.createdAt).toBe(entry.createdAt);
    });

    it("throws when updating a non-existent entry", async () => {
      await expect(
        journalRepo.update("00000000-0000-0000-0000-000000000000", {
          body: "Nope",
        }),
      ).rejects.toThrow("JournalEntry not found");
    });
  });

  describe("softDelete", () => {
    it("sets deletedAt", async () => {
      const entry = await journalRepo.create(baseEntry);
      await journalRepo.softDelete(entry.id);

      const raw = await db.journalEntries.get(entry.id);
      expect(raw?.deletedAt).toBeDefined();
    });
  });

  describe("getById", () => {
    it("returns an entry by id", async () => {
      const entry = await journalRepo.create(baseEntry);
      const found = await journalRepo.getById(entry.id);
      expect(found?.id).toBe(entry.id);
    });

    it("returns undefined for soft-deleted entries", async () => {
      const entry = await journalRepo.create(baseEntry);
      await journalRepo.softDelete(entry.id);
      expect(await journalRepo.getById(entry.id)).toBeUndefined();
    });
  });

  describe("getByPlantId", () => {
    it("returns entries for a specific plant", async () => {
      const plantId = "00000000-0000-0000-0000-000000000001";
      await journalRepo.create({
        ...baseEntry,
        plantInstanceId: plantId,
      });
      await journalRepo.create(baseEntry); // no plant

      const results = await journalRepo.getByPlantId(plantId);
      expect(results).toHaveLength(1);
    });
  });

  describe("getRecent", () => {
    it("returns the most recent entries", async () => {
      for (let i = 0; i < 5; i++) {
        await journalRepo.create({
          ...baseEntry,
          body: `Entry ${i}`,
        });
      }

      const recent = await journalRepo.getRecent(3);
      expect(recent).toHaveLength(3);
    });

    it("excludes soft-deleted entries", async () => {
      const entry = await journalRepo.create(baseEntry);
      await journalRepo.softDelete(entry.id);
      await journalRepo.create({ ...baseEntry, body: "Still here" });

      const recent = await journalRepo.getRecent(10);
      expect(recent).toHaveLength(1);
      expect(recent[0]?.body).toBe("Still here");
    });
  });

  describe("getByActivityType", () => {
    it("filters by activity type", async () => {
      await journalRepo.create(baseEntry);
      await journalRepo.create({
        ...baseEntry,
        activityType: "watering",
      });

      const results = await journalRepo.getByActivityType("watering");
      expect(results).toHaveLength(1);
    });
  });

  describe("getByDateRange", () => {
    it("returns entries within the date range", async () => {
      const entry = await journalRepo.create(baseEntry);
      // Use the created entry's timestamp to construct a valid range
      const start = entry.createdAt;
      const end = new Date(
        new Date(entry.createdAt).getTime() + 1000,
      ).toISOString();

      const results = await journalRepo.getByDateRange(start, end);
      expect(results).toHaveLength(1);
    });
  });
});
