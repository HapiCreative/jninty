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

const seedRepo = await import("./seedRepository.ts");

const baseSeed = {
  name: "San Marzano Tomato Seeds",
  species: "Solanum lycopersicum",
  quantityRemaining: 50,
  quantityUnit: "count" as const,
};

beforeEach(async () => {
  testDB = new PouchDB(`test-seed-${crypto.randomUUID()}`, {
    adapter: "memory",
  });
});

describe("PouchDB seedRepository", () => {
  describe("CRUD", () => {
    it("creates a seed with auto-generated fields", async () => {
      const seed = await seedRepo.create(baseSeed);
      expect(seed.id).toBeDefined();
      expect(seed.version).toBe(1);
      expect(seed.name).toBe("San Marzano Tomato Seeds");
      expect(seed.quantityRemaining).toBe(50);
    });

    it("updates a seed", async () => {
      const seed = await seedRepo.create(baseSeed);
      const updated = await seedRepo.update(seed.id, { variety: "Roma" });

      expect(updated.variety).toBe("Roma");
      expect(updated.version).toBe(2);
    });

    it("soft deletes a seed", async () => {
      const seed = await seedRepo.create(baseSeed);
      await seedRepo.softDelete(seed.id);

      expect(await seedRepo.getById(seed.id)).toBeUndefined();
      expect(await seedRepo.getAll()).toHaveLength(0);
    });
  });

  describe("getBySpecies", () => {
    it("filters by species", async () => {
      await seedRepo.create(baseSeed);
      await seedRepo.create({
        ...baseSeed,
        name: "Basil Seeds",
        species: "Ocimum basilicum",
      });

      const tomatoes = await seedRepo.getBySpecies("Solanum lycopersicum");
      expect(tomatoes).toHaveLength(1);
    });
  });

  describe("getExpiringSoon", () => {
    it("returns seeds expiring within the given days", async () => {
      const tomorrow = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      );
      await seedRepo.create({
        ...baseSeed,
        expiryDate: tomorrow.toISOString().split("T")[0],
      });
      await seedRepo.create({
        ...baseSeed,
        name: "Far future",
        expiryDate: "2030-12-31",
      });

      const expiring = await seedRepo.getExpiringSoon(7);
      expect(expiring).toHaveLength(1);
    });
  });

  describe("deductQuantity", () => {
    it("deducts from remaining quantity", async () => {
      const seed = await seedRepo.create(baseSeed);
      const deducted = await seedRepo.deductQuantity(seed.id, 10);

      expect(deducted.quantityRemaining).toBe(40);
      expect(deducted.version).toBe(2);
    });

    it("throws for amount exceeding remaining", async () => {
      const seed = await seedRepo.create(baseSeed);
      await expect(
        seedRepo.deductQuantity(seed.id, 100),
      ).rejects.toThrow("Insufficient quantity");
    });

    it("throws for non-positive amount", async () => {
      const seed = await seedRepo.create(baseSeed);
      await expect(seedRepo.deductQuantity(seed.id, 0)).rejects.toThrow(
        "Deduction amount must be positive",
      );
    });
  });
});
