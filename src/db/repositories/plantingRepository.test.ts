import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../schema.ts";
import * as plantingRepo from "./plantingRepository.ts";
import * as seasonRepo from "./seasonRepository.ts";
import * as plantRepo from "./plantRepository.ts";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function createSeasonAndPlant() {
  const season = await seasonRepo.create({
    name: "2026 Growing Season",
    year: 2026,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    isActive: true,
  });
  const plant = await plantRepo.create({
    species: "Solanum lycopersicum",
    type: "vegetable",
    isPerennial: false,
    source: "seed",
    status: "active",
    tags: ["tomato"],
  });
  return { season, plant };
}

describe("plantingRepository", () => {
  describe("create", () => {
    it("creates a planting with auto-generated fields", async () => {
      const { season, plant } = await createSeasonAndPlant();
      const planting = await plantingRepo.create({
        plantInstanceId: plant.id,
        seasonId: season.id,
      });

      expect(planting.id).toBeDefined();
      expect(planting.version).toBe(1);
      expect(planting.plantInstanceId).toBe(plant.id);
      expect(planting.seasonId).toBe(season.id);
    });

    it("creates a planting with all optional fields", async () => {
      const { season, plant } = await createSeasonAndPlant();
      const planting = await plantingRepo.create({
        plantInstanceId: plant.id,
        seasonId: season.id,
        datePlanted: "2026-04-15",
        dateRemoved: "2026-10-01",
        outcome: "thrived",
        notes: "Great harvest",
      });

      expect(planting.outcome).toBe("thrived");
      expect(planting.notes).toBe("Great harvest");
    });
  });

  describe("update", () => {
    it("increments version and updates timestamp", async () => {
      const { season, plant } = await createSeasonAndPlant();
      const planting = await plantingRepo.create({
        plantInstanceId: plant.id,
        seasonId: season.id,
      });

      const updated = await plantingRepo.update(planting.id, {
        outcome: "ok",
      });

      expect(updated.version).toBe(2);
      expect(updated.outcome).toBe("ok");
    });

    it("throws when updating non-existent planting", async () => {
      await expect(
        plantingRepo.update("00000000-0000-0000-0000-000000000000", {
          outcome: "ok",
        }),
      ).rejects.toThrow("Planting not found");
    });
  });

  describe("softDelete", () => {
    it("sets deletedAt", async () => {
      const { season, plant } = await createSeasonAndPlant();
      const planting = await plantingRepo.create({
        plantInstanceId: plant.id,
        seasonId: season.id,
      });
      await plantingRepo.softDelete(planting.id);

      const raw = await db.plantings.get(planting.id);
      expect(raw?.deletedAt).toBeDefined();
    });
  });

  describe("getBySeason", () => {
    it("returns plantings for a specific season", async () => {
      const { season, plant } = await createSeasonAndPlant();
      await plantingRepo.create({
        plantInstanceId: plant.id,
        seasonId: season.id,
      });

      const results = await plantingRepo.getBySeason(season.id);
      expect(results).toHaveLength(1);
    });

    it("excludes soft-deleted plantings", async () => {
      const { season, plant } = await createSeasonAndPlant();
      const planting = await plantingRepo.create({
        plantInstanceId: plant.id,
        seasonId: season.id,
      });
      await plantingRepo.softDelete(planting.id);

      const results = await plantingRepo.getBySeason(season.id);
      expect(results).toHaveLength(0);
    });
  });

  describe("getByPlant", () => {
    it("returns plantings for a specific plant across seasons", async () => {
      const { season, plant } = await createSeasonAndPlant();
      const season2 = await seasonRepo.create({
        name: "2025 Growing Season",
        year: 2025,
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        isActive: false,
      });

      await plantingRepo.create({
        plantInstanceId: plant.id,
        seasonId: season.id,
      });
      await plantingRepo.create({
        plantInstanceId: plant.id,
        seasonId: season2.id,
      });

      const results = await plantingRepo.getByPlant(plant.id);
      expect(results).toHaveLength(2);
    });
  });

  describe("getByBed", () => {
    it("returns plantings for a specific bed", async () => {
      const { season, plant } = await createSeasonAndPlant();
      const bedId = "00000000-0000-0000-0000-000000000099";

      await plantingRepo.create({
        plantInstanceId: plant.id,
        seasonId: season.id,
        bedId,
      });

      const results = await plantingRepo.getByBed(bedId);
      expect(results).toHaveLength(1);
    });
  });

  describe("getAll", () => {
    it("returns all non-deleted plantings", async () => {
      const { season, plant } = await createSeasonAndPlant();
      await plantingRepo.create({
        plantInstanceId: plant.id,
        seasonId: season.id,
      });
      const p2 = await plantingRepo.create({
        plantInstanceId: plant.id,
        seasonId: season.id,
      });
      await plantingRepo.softDelete(p2.id);

      const all = await plantingRepo.getAll();
      expect(all).toHaveLength(1);
    });
  });
});
