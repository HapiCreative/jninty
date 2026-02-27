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

const seasonRepo = await import("./seasonRepository.ts");

const baseSeason = {
  name: "2026 Growing Season",
  year: 2026,
  startDate: "2026-03-15",
  endDate: "2026-10-31",
  isActive: false,
};

beforeEach(async () => {
  testDB = new PouchDB(`test-season-${crypto.randomUUID()}`, {
    adapter: "memory",
  });
});

describe("PouchDB seasonRepository", () => {
  describe("CRUD", () => {
    it("creates a season", async () => {
      const season = await seasonRepo.create(baseSeason);
      expect(season.id).toBeDefined();
      expect(season.year).toBe(2026);
      expect(season.isActive).toBe(false);
    });

    it("updates a season", async () => {
      const season = await seasonRepo.create(baseSeason);
      const updated = await seasonRepo.update(season.id, {
        name: "Updated Name",
      });
      expect(updated.name).toBe("Updated Name");
      expect(updated.version).toBe(2);
    });

    it("soft deletes a season", async () => {
      const season = await seasonRepo.create(baseSeason);
      await seasonRepo.softDelete(season.id);
      expect(await seasonRepo.getById(season.id)).toBeUndefined();
    });
  });

  describe("getActive", () => {
    it("returns the active season", async () => {
      await seasonRepo.create(baseSeason);
      const active = await seasonRepo.create({
        ...baseSeason,
        name: "Active Season",
        isActive: true,
      });

      const found = await seasonRepo.getActive();
      expect(found?.id).toBe(active.id);
      expect(found?.isActive).toBe(true);
    });

    it("returns undefined when no active season", async () => {
      await seasonRepo.create(baseSeason);
      const found = await seasonRepo.getActive();
      expect(found).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("returns all non-deleted seasons ordered by year desc", async () => {
      await seasonRepo.create(baseSeason);
      await seasonRepo.create({
        ...baseSeason,
        name: "2025 Season",
        year: 2025,
      });
      const toDelete = await seasonRepo.create({
        ...baseSeason,
        name: "Deleted",
        year: 2024,
      });
      await seasonRepo.softDelete(toDelete.id);

      const all = await seasonRepo.getAll();
      expect(all).toHaveLength(2);
      expect(all[0]?.year).toBe(2026);
    });
  });

  describe("setActive", () => {
    it("activates target and deactivates others", async () => {
      const s1 = await seasonRepo.create({
        ...baseSeason,
        isActive: true,
      });
      const s2 = await seasonRepo.create({
        ...baseSeason,
        name: "2025",
        year: 2025,
        isActive: false,
      });

      const activated = await seasonRepo.setActive(s2.id);
      expect(activated.isActive).toBe(true);

      const former = await seasonRepo.getById(s1.id);
      expect(former?.isActive).toBe(false);
    });

    it("throws for non-existent season", async () => {
      await expect(
        seasonRepo.setActive("nonexistent"),
      ).rejects.toThrow("Season not found");
    });
  });
});
