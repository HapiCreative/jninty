import { describe, it, expect, beforeEach, vi } from "vitest";
import PouchDB from "pouchdb";
import PouchDBFind from "pouchdb-find";
import PouchDBAdapterMemory from "pouchdb-adapter-memory";

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(PouchDBAdapterMemory);

// Mock the client module to use an in-memory PouchDB for tests
let testDB: PouchDB.Database;

vi.mock("../client.ts", () => ({
  get localDB() {
    return testDB;
  },
}));

// Import after mock setup
const plantRepo = await import("./plantRepository.ts");

const basePlant = {
  species: "Solanum lycopersicum",
  type: "vegetable" as const,
  isPerennial: false,
  source: "seed" as const,
  status: "active" as const,
  tags: ["tomato", "summer"],
};

beforeEach(async () => {
  testDB = new PouchDB(`test-plant-${crypto.randomUUID()}`, {
    adapter: "memory",
  });
});

describe("PouchDB plantRepository", () => {
  describe("create", () => {
    it("creates a plant with auto-generated base fields", async () => {
      const plant = await plantRepo.create(basePlant);

      expect(plant.id).toBeDefined();
      expect(plant.version).toBe(1);
      expect(plant.createdAt).toBeDefined();
      expect(plant.updatedAt).toBeDefined();
      expect(plant.species).toBe("Solanum lycopersicum");
      expect(plant.deletedAt).toBeUndefined();
    });

    it("creates a plant with optional fields", async () => {
      const plant = await plantRepo.create({
        ...basePlant,
        nickname: "Big Boy",
        variety: "Roma",
        careNotes: "Needs staking",
      });

      expect(plant.nickname).toBe("Big Boy");
      expect(plant.variety).toBe("Roma");
      expect(plant.careNotes).toBe("Needs staking");
    });

    it("stores document with correct docType in PouchDB", async () => {
      const plant = await plantRepo.create(basePlant);
      const doc = await testDB.get(`plant:${plant.id}`);
      expect((doc as Record<string, unknown>)["docType"]).toBe("plant");
    });
  });

  describe("update", () => {
    it("increments version and preserves createdAt", async () => {
      const plant = await plantRepo.create(basePlant);
      const updated = await plantRepo.update(plant.id, {
        nickname: "Updated Name",
      });

      expect(updated.version).toBe(2);
      expect(updated.nickname).toBe("Updated Name");
      expect(updated.createdAt).toBe(plant.createdAt);
      expect(new Date(updated.updatedAt).toISOString()).toBe(
        updated.updatedAt,
      );
    });

    it("throws when updating a non-existent plant", async () => {
      await expect(
        plantRepo.update("00000000-0000-0000-0000-000000000000", {
          nickname: "Nope",
        }),
      ).rejects.toThrow("PlantInstance not found");
    });

    it("throws when updating a soft-deleted plant", async () => {
      const plant = await plantRepo.create(basePlant);
      await plantRepo.softDelete(plant.id);

      await expect(
        plantRepo.update(plant.id, { nickname: "Nope" }),
      ).rejects.toThrow("PlantInstance not found");
    });
  });

  describe("softDelete", () => {
    it("sets deletedAt and increments version", async () => {
      const plant = await plantRepo.create(basePlant);
      await plantRepo.softDelete(plant.id);

      // Direct DB read to verify soft-delete
      const raw = await testDB.get(`plant:${plant.id}`);
      expect((raw as Record<string, unknown>)["deletedAt"]).toBeDefined();
      expect((raw as Record<string, unknown>)["version"]).toBe(2);
    });

    it("throws when deleting a non-existent plant", async () => {
      await expect(
        plantRepo.softDelete("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow("PlantInstance not found");
    });
  });

  describe("getById", () => {
    it("returns a plant by id", async () => {
      const plant = await plantRepo.create(basePlant);
      const found = await plantRepo.getById(plant.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(plant.id);
    });

    it("returns undefined for soft-deleted plants", async () => {
      const plant = await plantRepo.create(basePlant);
      await plantRepo.softDelete(plant.id);

      const found = await plantRepo.getById(plant.id);
      expect(found).toBeUndefined();
    });

    it("returns undefined for non-existent id", async () => {
      const found = await plantRepo.getById(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(found).toBeUndefined();
    });

    it("does not include PouchDB fields (_id, _rev, docType)", async () => {
      const plant = await plantRepo.create(basePlant);
      const found = await plantRepo.getById(plant.id);

      expect(found).toBeDefined();
      expect((found as Record<string, unknown>)["_id"]).toBeUndefined();
      expect((found as Record<string, unknown>)["_rev"]).toBeUndefined();
      expect((found as Record<string, unknown>)["docType"]).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("returns all non-deleted plants", async () => {
      await plantRepo.create(basePlant);
      await plantRepo.create({ ...basePlant, species: "Capsicum annuum" });
      const toDelete = await plantRepo.create({
        ...basePlant,
        species: "Deleted",
      });
      await plantRepo.softDelete(toDelete.id);

      const all = await plantRepo.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe("getByStatus", () => {
    it("filters by status excluding soft-deleted", async () => {
      await plantRepo.create(basePlant);
      await plantRepo.create({ ...basePlant, status: "dormant" });

      const active = await plantRepo.getByStatus("active");
      expect(active).toHaveLength(1);
      expect(active[0]?.status).toBe("active");
    });
  });

  describe("getByType", () => {
    it("filters by type excluding soft-deleted", async () => {
      await plantRepo.create(basePlant);
      await plantRepo.create({
        ...basePlant,
        type: "herb",
        species: "Ocimum basilicum",
      });

      const veggies = await plantRepo.getByType("vegetable");
      expect(veggies).toHaveLength(1);
      expect(veggies[0]?.type).toBe("vegetable");
    });
  });

  describe("docType isolation", () => {
    it("only returns plant documents, not other docTypes", async () => {
      // Manually insert a non-plant doc into the same DB
      await testDB.put({
        _id: "journal:fake-123",
        docType: "journal",
        id: "fake-123",
        body: "Not a plant",
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await plantRepo.create(basePlant);

      const all = await plantRepo.getAll();
      expect(all).toHaveLength(1);
      expect(all[0]?.species).toBe("Solanum lycopersicum");
    });
  });
});
