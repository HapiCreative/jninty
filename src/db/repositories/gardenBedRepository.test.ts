import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../schema.ts";
import * as gardenBedRepo from "./gardenBedRepository.ts";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const baseBed = {
  name: "North Raised Bed",
  type: "vegetable_bed" as const,
  gridX: 0,
  gridY: 0,
  gridWidth: 4,
  gridHeight: 2,
  shape: "rectangle" as const,
  color: "#7dbf4e",
};

describe("gardenBedRepository", () => {
  describe("create", () => {
    it("creates a bed with auto-generated fields", async () => {
      const bed = await gardenBedRepo.create(baseBed);

      expect(bed.id).toBeDefined();
      expect(bed.version).toBe(1);
      expect(bed.createdAt).toBeDefined();
      expect(bed.name).toBe("North Raised Bed");
      expect(bed.type).toBe("vegetable_bed");
    });
  });

  describe("update", () => {
    it("increments version and updates fields", async () => {
      const bed = await gardenBedRepo.create(baseBed);
      const updated = await gardenBedRepo.update(bed.id, {
        name: "South Raised Bed",
      });

      expect(updated.version).toBe(2);
      expect(updated.name).toBe("South Raised Bed");
      expect(updated.createdAt).toBe(bed.createdAt);
    });

    it("throws when updating a non-existent bed", async () => {
      await expect(
        gardenBedRepo.update("00000000-0000-0000-0000-000000000000", {
          name: "Nope",
        }),
      ).rejects.toThrow("GardenBed not found");
    });

    it("throws when updating a soft-deleted bed", async () => {
      const bed = await gardenBedRepo.create(baseBed);
      await gardenBedRepo.softDelete(bed.id);

      await expect(
        gardenBedRepo.update(bed.id, { name: "Nope" }),
      ).rejects.toThrow("GardenBed not found");
    });
  });

  describe("softDelete", () => {
    it("sets deletedAt and increments version", async () => {
      const bed = await gardenBedRepo.create(baseBed);
      await gardenBedRepo.softDelete(bed.id);

      const raw = await db.gardenBeds.get(bed.id);
      expect(raw?.deletedAt).toBeDefined();
      expect(raw?.version).toBe(2);
    });

    it("throws when deleting a non-existent bed", async () => {
      await expect(
        gardenBedRepo.softDelete("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow("GardenBed not found");
    });
  });

  describe("getById", () => {
    it("returns a bed by id", async () => {
      const bed = await gardenBedRepo.create(baseBed);
      const found = await gardenBedRepo.getById(bed.id);
      expect(found?.id).toBe(bed.id);
    });

    it("returns undefined for soft-deleted beds", async () => {
      const bed = await gardenBedRepo.create(baseBed);
      await gardenBedRepo.softDelete(bed.id);
      expect(await gardenBedRepo.getById(bed.id)).toBeUndefined();
    });

    it("returns undefined for non-existent id", async () => {
      const found = await gardenBedRepo.getById(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(found).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("returns all non-deleted beds", async () => {
      await gardenBedRepo.create(baseBed);
      await gardenBedRepo.create({ name: "Herb Spiral", type: "herb_garden", gridX: 0, gridY: 3, gridWidth: 3, gridHeight: 3, shape: "rectangle" as const, color: "#7dbf4e" });
      const toDelete = await gardenBedRepo.create({
        name: "Old Bed",
        type: "other",
        gridX: 0,
        gridY: 6,
        gridWidth: 2,
        gridHeight: 2,
        shape: "rectangle" as const,
        color: "#7dbf4e",
      });
      await gardenBedRepo.softDelete(toDelete.id);

      const all = await gardenBedRepo.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe("getByType", () => {
    it("filters by type excluding soft-deleted", async () => {
      await gardenBedRepo.create(baseBed);
      await gardenBedRepo.create({ name: "Herb Spiral", type: "herb_garden", gridX: 0, gridY: 3, gridWidth: 3, gridHeight: 3, shape: "rectangle" as const, color: "#7dbf4e" });

      const vegBeds = await gardenBedRepo.getByType("vegetable_bed");
      expect(vegBeds).toHaveLength(1);
      expect(vegBeds[0]?.type).toBe("vegetable_bed");
    });
  });
});
