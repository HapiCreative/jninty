import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../schema.ts";
import * as seasonRepo from "./seasonRepository.ts";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const baseSeason = {
  name: "2026 Growing Season",
  year: 2026,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  isActive: true,
};

describe("seasonRepository", () => {
  describe("create", () => {
    it("creates a season with auto-generated fields", async () => {
      const season = await seasonRepo.create(baseSeason);

      expect(season.id).toBeDefined();
      expect(season.version).toBe(1);
      expect(season.createdAt).toBeDefined();
      expect(season.name).toBe("2026 Growing Season");
      expect(season.year).toBe(2026);
      expect(season.isActive).toBe(true);
    });
  });

  describe("update", () => {
    it("increments version and updates timestamp", async () => {
      const season = await seasonRepo.create(baseSeason);
      const updated = await seasonRepo.update(season.id, {
        name: "2026 Spring/Summer",
      });

      expect(updated.version).toBe(2);
      expect(updated.name).toBe("2026 Spring/Summer");
      expect(updated.createdAt).toBe(season.createdAt);
    });

    it("throws when updating a non-existent season", async () => {
      await expect(
        seasonRepo.update("00000000-0000-0000-0000-000000000000", {
          name: "Nope",
        }),
      ).rejects.toThrow("Season not found");
    });
  });

  describe("softDelete", () => {
    it("sets deletedAt", async () => {
      const season = await seasonRepo.create(baseSeason);
      await seasonRepo.softDelete(season.id);

      const raw = await db.seasons.get(season.id);
      expect(raw?.deletedAt).toBeDefined();
    });
  });

  describe("getById", () => {
    it("returns a season by id", async () => {
      const season = await seasonRepo.create(baseSeason);
      const found = await seasonRepo.getById(season.id);
      expect(found?.id).toBe(season.id);
    });

    it("returns undefined for soft-deleted seasons", async () => {
      const season = await seasonRepo.create(baseSeason);
      await seasonRepo.softDelete(season.id);
      expect(await seasonRepo.getById(season.id)).toBeUndefined();
    });
  });

  describe("getActive", () => {
    it("returns the active season", async () => {
      await seasonRepo.create(baseSeason);
      const active = await seasonRepo.getActive();
      expect(active?.isActive).toBe(true);
    });

    it("returns undefined when no active season", async () => {
      await seasonRepo.create({ ...baseSeason, isActive: false });
      const active = await seasonRepo.getActive();
      expect(active).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("returns all non-deleted seasons ordered by year descending", async () => {
      await seasonRepo.create(baseSeason);
      await seasonRepo.create({
        ...baseSeason,
        name: "2025 Growing Season",
        year: 2025,
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        isActive: false,
      });

      const all = await seasonRepo.getAll();
      expect(all).toHaveLength(2);
      expect(all[0]?.year).toBe(2026);
      expect(all[1]?.year).toBe(2025);
    });

    it("excludes soft-deleted seasons", async () => {
      const season = await seasonRepo.create(baseSeason);
      await seasonRepo.softDelete(season.id);

      const all = await seasonRepo.getAll();
      expect(all).toHaveLength(0);
    });
  });

  describe("setActive", () => {
    it("activates the target season and deactivates others", async () => {
      const s1 = await seasonRepo.create(baseSeason);
      const s2 = await seasonRepo.create({
        ...baseSeason,
        name: "2025 Growing Season",
        year: 2025,
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        isActive: false,
      });

      await seasonRepo.setActive(s2.id);

      const updated1 = await seasonRepo.getById(s1.id);
      const updated2 = await seasonRepo.getById(s2.id);
      expect(updated1?.isActive).toBe(false);
      expect(updated2?.isActive).toBe(true);
    });

    it("throws for non-existent season", async () => {
      await expect(
        seasonRepo.setActive("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow("Season not found");
    });
  });
});
