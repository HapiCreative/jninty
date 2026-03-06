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
const repo = await import("./userPlantKnowledgeRepository.ts");

const baseEntry = {
  species: "Solanum lycopersicum",
  commonName: "Tomato",
  plantType: "vegetable" as const,
  isPerennial: false,
  cropGroup: "tomato",
  sunNeeds: "full_sun" as const,
  waterNeeds: "moderate" as const,
};

beforeEach(async () => {
  testDB = new PouchDB(`test-upk-${crypto.randomUUID()}`, {
    adapter: "memory",
  });
});

describe("PouchDB userPlantKnowledgeRepository", () => {
  describe("create", () => {
    it("creates an entry with auto-generated base fields", async () => {
      const entry = await repo.create(baseEntry);

      expect(entry.id).toBeDefined();
      expect(entry.version).toBe(1);
      expect(entry.createdAt).toBeDefined();
      expect(entry.updatedAt).toBeDefined();
      expect(entry.species).toBe("Solanum lycopersicum");
      expect(entry.commonName).toBe("Tomato");
      expect(entry.deletedAt).toBeUndefined();
    });

    it("creates an entry with optional fields", async () => {
      const entry = await repo.create({
        ...baseEntry,
        variety: "Roma",
        soilPreference: "Well-drained",
        goodCompanions: ["Basil", "Carrots"],
      });

      expect(entry.variety).toBe("Roma");
      expect(entry.soilPreference).toBe("Well-drained");
      expect(entry.goodCompanions).toEqual(["Basil", "Carrots"]);
    });

    it("stores document with correct docType in PouchDB", async () => {
      const entry = await repo.create(baseEntry);
      const doc = await testDB.get(`userPlantKnowledge:${entry.id}`);
      expect(
        (doc as unknown as Record<string, unknown>)["docType"],
      ).toBe("userPlantKnowledge");
    });
  });

  describe("update", () => {
    it("increments version and preserves createdAt", async () => {
      const entry = await repo.create(baseEntry);
      const updated = await repo.update(entry.id, {
        commonName: "Updated Tomato",
      });

      expect(updated.version).toBe(2);
      expect(updated.commonName).toBe("Updated Tomato");
      expect(updated.createdAt).toBe(entry.createdAt);
    });

    it("throws when updating a non-existent entry", async () => {
      await expect(
        repo.update("00000000-0000-0000-0000-000000000000", {
          commonName: "Nope",
        }),
      ).rejects.toThrow("UserPlantKnowledge not found");
    });

    it("throws when updating a soft-deleted entry", async () => {
      const entry = await repo.create(baseEntry);
      await repo.softDelete(entry.id);

      await expect(
        repo.update(entry.id, { commonName: "Nope" }),
      ).rejects.toThrow("UserPlantKnowledge not found");
    });
  });

  describe("softDelete", () => {
    it("sets deletedAt and increments version", async () => {
      const entry = await repo.create(baseEntry);
      await repo.softDelete(entry.id);

      const raw = await testDB.get(`userPlantKnowledge:${entry.id}`);
      expect(
        (raw as unknown as Record<string, unknown>)["deletedAt"],
      ).toBeDefined();
      expect((raw as unknown as Record<string, unknown>)["version"]).toBe(2);
    });

    it("throws when deleting a non-existent entry", async () => {
      await expect(
        repo.softDelete("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow("UserPlantKnowledge not found");
    });
  });

  describe("getById", () => {
    it("returns an entry by id", async () => {
      const entry = await repo.create(baseEntry);
      const found = await repo.getById(entry.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(entry.id);
    });

    it("returns undefined for soft-deleted entries", async () => {
      const entry = await repo.create(baseEntry);
      await repo.softDelete(entry.id);

      const found = await repo.getById(entry.id);
      expect(found).toBeUndefined();
    });

    it("returns undefined for non-existent id", async () => {
      const found = await repo.getById(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(found).toBeUndefined();
    });

    it("does not include PouchDB fields", async () => {
      const entry = await repo.create(baseEntry);
      const found = await repo.getById(entry.id);

      expect(found).toBeDefined();
      expect((found as Record<string, unknown>)["_id"]).toBeUndefined();
      expect((found as Record<string, unknown>)["_rev"]).toBeUndefined();
      expect((found as Record<string, unknown>)["docType"]).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("returns all non-deleted entries", async () => {
      await repo.create(baseEntry);
      await repo.create({
        ...baseEntry,
        species: "Ocimum basilicum",
        commonName: "Basil",
        plantType: "herb",
      });
      const toDelete = await repo.create({
        ...baseEntry,
        species: "Deleted",
        commonName: "Deleted",
      });
      await repo.softDelete(toDelete.id);

      const all = await repo.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe("docType isolation", () => {
    it("only returns userPlantKnowledge documents", async () => {
      // Manually insert a plant doc
      await testDB.put({
        _id: "plant:fake-123",
        docType: "plant",
        id: "fake-123",
        species: "Not knowledge",
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await repo.create(baseEntry);

      const all = await repo.getAll();
      expect(all).toHaveLength(1);
      expect(all[0]?.commonName).toBe("Tomato");
    });
  });
});
