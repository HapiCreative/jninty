import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../schema.ts";
import * as seedRepo from "./seedRepository.ts";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const baseSeed = {
  name: "San Marzano Tomato Seeds",
  species: "Solanum lycopersicum",
  quantityRemaining: 25,
  quantityUnit: "count" as const,
};

describe("seedRepository", () => {
  describe("create", () => {
    it("creates a seed with auto-generated base fields", async () => {
      const seed = await seedRepo.create(baseSeed);

      expect(seed.id).toBeDefined();
      expect(seed.version).toBe(1);
      expect(seed.createdAt).toBeDefined();
      expect(seed.updatedAt).toBeDefined();
      expect(seed.name).toBe("San Marzano Tomato Seeds");
      expect(seed.species).toBe("Solanum lycopersicum");
      expect(seed.quantityRemaining).toBe(25);
      expect(seed.quantityUnit).toBe("count");
      expect(seed.deletedAt).toBeUndefined();
    });

    it("creates a seed with optional fields", async () => {
      const seed = await seedRepo.create({
        ...baseSeed,
        variety: "San Marzano",
        brand: "Burpee",
        supplier: "Home Depot",
        purchaseDate: "2026-01-15",
        expiryDate: "2027-06-30",
        germinationRate: 85,
        cost: 3.99,
        storageLocation: "Fridge box A",
        notes: "Great for sauce",
      });

      expect(seed.variety).toBe("San Marzano");
      expect(seed.brand).toBe("Burpee");
      expect(seed.supplier).toBe("Home Depot");
      expect(seed.purchaseDate).toBe("2026-01-15");
      expect(seed.expiryDate).toBe("2027-06-30");
      expect(seed.germinationRate).toBe(85);
      expect(seed.cost).toBe(3.99);
      expect(seed.storageLocation).toBe("Fridge box A");
      expect(seed.notes).toBe("Great for sauce");
    });
  });

  describe("update", () => {
    it("increments version and preserves createdAt", async () => {
      const seed = await seedRepo.create(baseSeed);
      const updated = await seedRepo.update(seed.id, {
        name: "Updated Name",
      });

      expect(updated.version).toBe(2);
      expect(updated.name).toBe("Updated Name");
      expect(updated.createdAt).toBe(seed.createdAt);
      expect(new Date(updated.updatedAt).toISOString()).toBe(
        updated.updatedAt,
      );
    });

    it("throws when updating a non-existent seed", async () => {
      await expect(
        seedRepo.update("00000000-0000-0000-0000-000000000000", {
          name: "Nope",
        }),
      ).rejects.toThrow("Seed not found");
    });

    it("throws when updating a soft-deleted seed", async () => {
      const seed = await seedRepo.create(baseSeed);
      await seedRepo.softDelete(seed.id);

      await expect(
        seedRepo.update(seed.id, { name: "Nope" }),
      ).rejects.toThrow("Seed not found");
    });
  });

  describe("softDelete", () => {
    it("sets deletedAt and increments version", async () => {
      const seed = await seedRepo.create(baseSeed);
      await seedRepo.softDelete(seed.id);

      const raw = await db.seeds.get(seed.id);
      expect(raw?.deletedAt).toBeDefined();
      expect(raw?.version).toBe(2);
    });

    it("throws when deleting a non-existent seed", async () => {
      await expect(
        seedRepo.softDelete("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow("Seed not found");
    });
  });

  describe("getById", () => {
    it("returns a seed by id", async () => {
      const seed = await seedRepo.create(baseSeed);
      const found = await seedRepo.getById(seed.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(seed.id);
    });

    it("returns undefined for soft-deleted seeds", async () => {
      const seed = await seedRepo.create(baseSeed);
      await seedRepo.softDelete(seed.id);

      const found = await seedRepo.getById(seed.id);
      expect(found).toBeUndefined();
    });

    it("returns undefined for non-existent id", async () => {
      const found = await seedRepo.getById(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(found).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("returns all non-deleted seeds", async () => {
      await seedRepo.create(baseSeed);
      await seedRepo.create({
        ...baseSeed,
        name: "Basil Seeds",
        species: "Ocimum basilicum",
      });
      const toDelete = await seedRepo.create({
        ...baseSeed,
        name: "Deleted Seeds",
      });
      await seedRepo.softDelete(toDelete.id);

      const all = await seedRepo.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe("getBySpecies", () => {
    it("filters by species excluding soft-deleted", async () => {
      await seedRepo.create(baseSeed);
      await seedRepo.create({
        ...baseSeed,
        name: "Cherry Tomato Seeds",
        species: "Solanum lycopersicum",
      });
      await seedRepo.create({
        ...baseSeed,
        name: "Basil Seeds",
        species: "Ocimum basilicum",
      });

      const tomatoes = await seedRepo.getBySpecies("Solanum lycopersicum");
      expect(tomatoes).toHaveLength(2);
    });
  });

  describe("getExpiringSoon", () => {
    it("returns seeds expiring within N days", async () => {
      const today = new Date();

      // Expiring in 10 days
      const soon = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);
      const soonDate = soon.toISOString().split("T")[0]!;
      await seedRepo.create({
        ...baseSeed,
        name: "Expiring Soon",
        expiryDate: soonDate,
      });

      // Expiring in 60 days
      const later = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
      const laterDate = later.toISOString().split("T")[0]!;
      await seedRepo.create({
        ...baseSeed,
        name: "Expiring Later",
        expiryDate: laterDate,
      });

      // Already expired (yesterday)
      const yesterday = new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000);
      const yesterdayDate = yesterday.toISOString().split("T")[0]!;
      await seedRepo.create({
        ...baseSeed,
        name: "Already Expired",
        expiryDate: yesterdayDate,
      });

      // No expiry date
      await seedRepo.create({
        ...baseSeed,
        name: "No Expiry",
      });

      const expiringSoon = await seedRepo.getExpiringSoon(30);
      expect(expiringSoon).toHaveLength(1);
      expect(expiringSoon[0]?.name).toBe("Expiring Soon");
    });
  });

  describe("deductQuantity", () => {
    it("deducts quantity successfully", async () => {
      const seed = await seedRepo.create(baseSeed);
      const updated = await seedRepo.deductQuantity(seed.id, 5);

      expect(updated.quantityRemaining).toBe(20);
      expect(updated.version).toBe(2);
    });

    it("deducts to zero", async () => {
      const seed = await seedRepo.create(baseSeed);
      const updated = await seedRepo.deductQuantity(seed.id, 25);

      expect(updated.quantityRemaining).toBe(0);
    });

    it("throws when deducting more than available", async () => {
      const seed = await seedRepo.create(baseSeed);

      await expect(seedRepo.deductQuantity(seed.id, 30)).rejects.toThrow(
        "Insufficient quantity",
      );
    });

    it("throws when amount is zero", async () => {
      const seed = await seedRepo.create(baseSeed);

      await expect(seedRepo.deductQuantity(seed.id, 0)).rejects.toThrow(
        "Deduction amount must be positive",
      );
    });

    it("throws when amount is negative", async () => {
      const seed = await seedRepo.create(baseSeed);

      await expect(seedRepo.deductQuantity(seed.id, -5)).rejects.toThrow(
        "Deduction amount must be positive",
      );
    });

    it("throws when seed is not found", async () => {
      await expect(
        seedRepo.deductQuantity(
          "00000000-0000-0000-0000-000000000000",
          5,
        ),
      ).rejects.toThrow("Seed not found");
    });

    it("throws when seed is soft-deleted", async () => {
      const seed = await seedRepo.create(baseSeed);
      await seedRepo.softDelete(seed.id);

      await expect(seedRepo.deductQuantity(seed.id, 5)).rejects.toThrow(
        "Seed not found",
      );
    });
  });
});
