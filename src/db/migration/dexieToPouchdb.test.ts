import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import PouchDB from "pouchdb";
import PouchDBAdapterMemory from "pouchdb-adapter-memory";
import PouchDBFind from "pouchdb-find";
import { Blob as NodeBlob } from "node:buffer";
import { db } from "../schema.ts";

PouchDB.plugin(PouchDBAdapterMemory);
PouchDB.plugin(PouchDBFind);

// Create a fresh in-memory PouchDB for each test
let testPouchDB: PouchDB.Database;

vi.mock("../pouchdb/client.ts", () => ({
  get localDB() {
    return testPouchDB;
  },
}));

// Mock OPFS — not available in jsdom
vi.mock("../../services/opfsStorage.ts", () => ({
  isOpfsAvailable: () => false,
  readFile: async () => undefined,
  displayPath: (id: string) => `photos/display/${id}.jpg`,
  originalPath: (id: string) => `photos/originals/${id}.jpg`,
}));

// Import after mocks are set up
const migration = await import("./dexieToPouchdb.ts");

// ─── Test data factories ───

function makePlant(overrides?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    species: "Solanum lycopersicum",
    type: "vegetable" as const,
    isPerennial: false,
    source: "seed" as const,
    status: "active" as const,
    tags: ["tomato"],
    version: 1,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function makeJournalEntry(overrides?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    activityType: "watering" as const,
    body: "Watered the tomatoes",
    seasonId: "season-1",
    photoIds: [] as string[],
    isMilestone: false,
    version: 1,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function makeTask(overrides?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "Water plants",
    dueDate: "2026-03-01",
    priority: "normal" as const,
    isCompleted: false,
    version: 1,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function makeGardenBed(overrides?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "Raised Bed 1",
    type: "vegetable_bed" as const,
    gridX: 0,
    gridY: 0,
    gridWidth: 4,
    gridHeight: 2,
    shape: "rectangle" as const,
    color: "#7dbf4e",
    version: 1,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function makeSeason(overrides?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "2026 Growing Season",
    year: 2026,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    isActive: true,
    version: 1,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function makeSeed(overrides?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "Roma Tomato Seeds",
    species: "Solanum lycopersicum",
    quantityRemaining: 50,
    quantityUnit: "packets" as const,
    version: 1,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function makeExpense(overrides?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "Soil mix",
    category: "tools" as const,
    amount: 25.99,
    date: "2026-03-01",
    version: 1,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

// Use Node.js native Blob which has proper arrayBuffer()/text() methods.
// jsdom's global Blob lacks these, breaking PouchDB attachment handling.
function makeBlob(content: string, type = "image/jpeg"): Blob {
  return new NodeBlob([content], { type }) as unknown as Blob;
}

function makePhoto(overrides?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    thumbnailBlob: makeBlob("thumb-data"),
    originalStored: false,
    version: 1,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

function makeSettings() {
  return {
    id: "singleton",
    growingZone: "7b",
    lastFrostDate: "2026-04-15",
    firstFrostDate: "2026-10-15",
    gridUnit: "feet" as const,
    temperatureUnit: "fahrenheit" as const,
    theme: "auto" as const,
    keepOriginalPhotos: false,
    dbSchemaVersion: 7,
    exportVersion: 1,
  };
}

// ─── Tests ───

beforeEach(async () => {
  // Reset Dexie
  await db.delete();
  await db.open();

  // Fresh PouchDB
  testPouchDB = new PouchDB(`test-migration-${crypto.randomUUID()}`, {
    adapter: "memory",
  });
});

describe("dexieToPouchdb migration", () => {
  describe("isMigrationComplete", () => {
    it("returns false when no marker exists", async () => {
      expect(await migration.isMigrationComplete()).toBe(false);
    });

    it("returns true when marker exists", async () => {
      await testPouchDB.put({
        _id: "migration:dexie-complete",
        completedAt: new Date().toISOString(),
      });
      expect(await migration.isMigrationComplete()).toBe(true);
    });
  });

  describe("dexieHasData", () => {
    it("returns false on empty database", async () => {
      expect(await migration.dexieHasData()).toBe(false);
    });

    it("returns true when plants exist", async () => {
      await db.plantInstances.add(makePlant());
      expect(await migration.dexieHasData()).toBe(true);
    });

    it("returns true when only settings exist", async () => {
      await db.settings.add(makeSettings());
      expect(await migration.dexieHasData()).toBe(true);
    });
  });

  describe("migrateAll", () => {
    it("migrates plants to PouchDB with correct docType and _id", async () => {
      const plant = makePlant();
      await db.plantInstances.add(plant);

      const result = await migration.migrateAll();

      expect(result.migrated).toBe(true);
      expect(result.counts.plantInstances).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Verify in PouchDB
      const doc = await testPouchDB.get(`plant:${plant.id}`);
      expect((doc as unknown as Record<string, unknown>)["docType"]).toBe("plant");
      expect((doc as unknown as Record<string, unknown>)["species"]).toBe(
        "Solanum lycopersicum",
      );
    });

    it("migrates journal entries", async () => {
      const entry = makeJournalEntry();
      await db.journalEntries.add(entry);

      const result = await migration.migrateAll();

      expect(result.counts.journalEntries).toBe(1);

      const doc = await testPouchDB.get(`journal:${entry.id}`);
      expect((doc as unknown as Record<string, unknown>)["docType"]).toBe("journal");
      expect((doc as unknown as Record<string, unknown>)["body"]).toBe(
        "Watered the tomatoes",
      );
    });

    it("migrates tasks", async () => {
      const task = makeTask();
      await db.tasks.add(task);

      const result = await migration.migrateAll();
      expect(result.counts.tasks).toBe(1);

      const doc = await testPouchDB.get(`task:${task.id}`);
      expect((doc as unknown as Record<string, unknown>)["title"]).toBe("Water plants");
    });

    it("migrates garden beds", async () => {
      const bed = makeGardenBed();
      await db.gardenBeds.add(bed);

      const result = await migration.migrateAll();
      expect(result.counts.gardenBeds).toBe(1);

      const doc = await testPouchDB.get(`gardenBed:${bed.id}`);
      expect((doc as unknown as Record<string, unknown>)["name"]).toBe("Raised Bed 1");
    });

    it("migrates seasons", async () => {
      const season = makeSeason();
      await db.seasons.add(season);

      const result = await migration.migrateAll();
      expect(result.counts.seasons).toBe(1);

      const doc = await testPouchDB.get(`season:${season.id}`);
      expect((doc as unknown as Record<string, unknown>)["year"]).toBe(2026);
    });

    it("migrates seeds", async () => {
      const seed = makeSeed();
      await db.seeds.add(seed);

      const result = await migration.migrateAll();
      expect(result.counts.seeds).toBe(1);

      const doc = await testPouchDB.get(`seed:${seed.id}`);
      expect((doc as unknown as Record<string, unknown>)["name"]).toBe(
        "Roma Tomato Seeds",
      );
    });

    it("migrates expenses", async () => {
      const expense = makeExpense();
      await db.expenses.add(expense);

      const result = await migration.migrateAll();
      expect(result.counts.expenses).toBe(1);

      const doc = await testPouchDB.get(`expense:${expense.id}`);
      expect((doc as unknown as Record<string, unknown>)["amount"]).toBe(25.99);
    });

    it("migrates settings with singleton _id", async () => {
      const settings = makeSettings();
      await db.settings.add(settings);

      const result = await migration.migrateAll();
      expect(result.counts.settings).toBe(1);

      const doc = await testPouchDB.get("settings:singleton");
      expect((doc as unknown as Record<string, unknown>)["growingZone"]).toBe("7b");
    });

    it("migrates multiple entities across tables", async () => {
      await db.plantInstances.add(makePlant());
      await db.plantInstances.add(makePlant({ species: "Capsicum annuum" }));
      await db.journalEntries.add(makeJournalEntry());
      await db.tasks.add(makeTask());
      await db.tasks.add(makeTask({ title: "Prune roses" }));
      await db.tasks.add(makeTask({ title: "Fertilize" }));
      await db.gardenBeds.add(makeGardenBed());
      await db.settings.add(makeSettings());

      const result = await migration.migrateAll();

      expect(result.migrated).toBe(true);
      expect(result.counts.plantInstances).toBe(2);
      expect(result.counts.journalEntries).toBe(1);
      expect(result.counts.tasks).toBe(3);
      expect(result.counts.gardenBeds).toBe(1);
      expect(result.counts.settings).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it("migrates photos with thumbnail as attachment", async () => {
      const photo = makePhoto();
      await db.photos.add(photo);

      const result = await migration.migrateAll();
      expect(result.counts.photos).toBe(1);

      const doc = await testPouchDB.get(`photo:${photo.id}`, {
        attachments: true,
        binary: true,
      });

      const attachments = (doc as unknown as Record<string, unknown>)._attachments as
        | Record<string, unknown>
        | undefined;
      expect(attachments).toBeDefined();
      expect(attachments?.["thumbnail"]).toBeDefined();
    });

    it("migrates photos with display blob as attachment", async () => {
      const photo = makePhoto({
        displayBlob: makeBlob("display-data"),
      });
      await db.photos.add(photo);

      const result = await migration.migrateAll();
      expect(result.counts.photos).toBe(1);

      const doc = await testPouchDB.get(`photo:${photo.id}`, {
        attachments: true,
        binary: true,
      });

      const attachments = (doc as unknown as Record<string, unknown>)._attachments as
        | Record<string, unknown>
        | undefined;
      expect(attachments?.["thumbnail"]).toBeDefined();
      expect(attachments?.["display"]).toBeDefined();
    });

    it("does not include blob fields in photo document body", async () => {
      const photo = makePhoto({
        displayBlob: makeBlob("display-data"),
      });
      await db.photos.add(photo);

      await migration.migrateAll();

      const doc = await testPouchDB.get(`photo:${photo.id}`);
      expect((doc as unknown as Record<string, unknown>)["thumbnailBlob"]).toBeUndefined();
      expect((doc as unknown as Record<string, unknown>)["displayBlob"]).toBeUndefined();
    });

    it("stores migration completion marker", async () => {
      await db.plantInstances.add(makePlant());

      await migration.migrateAll();

      const marker = await testPouchDB.get("migration:dexie-complete");
      expect(marker).toBeDefined();
      expect(
        (marker as unknown as Record<string, unknown>)["completedAt"],
      ).toBeDefined();
    });

    it("is idempotent — running twice does not duplicate data", async () => {
      await db.plantInstances.add(makePlant());
      await db.journalEntries.add(makeJournalEntry());

      const first = await migration.migrateAll();
      expect(first.migrated).toBe(true);
      expect(first.counts.plantInstances).toBe(1);

      const second = await migration.migrateAll();
      expect(second.migrated).toBe(false);
      expect(second.counts.plantInstances).toBe(0);

      // Verify only one plant doc exists
      const allDocs = await testPouchDB.allDocs({
        startkey: "plant:",
        endkey: "plant:\ufff0",
      });
      expect(allDocs.rows).toHaveLength(1);
    });

    it("reports progress callbacks", async () => {
      await db.plantInstances.add(makePlant());
      await db.plantInstances.add(makePlant({ species: "Basil" }));

      const progressCalls: Array<{
        table: string;
        current: number;
        total: number;
      }> = [];

      await migration.migrateAll((p) => progressCalls.push({ ...p }));

      // Should have progress updates for plantInstances
      const plantProgress = progressCalls.filter(
        (p) => p.table === "plantInstances",
      );
      expect(plantProgress.length).toBeGreaterThan(0);

      // Last progress call should show completion
      const lastPlant = plantProgress[plantProgress.length - 1];
      expect(lastPlant?.current).toBe(2);
      expect(lastPlant?.total).toBe(2);
    });

    it("handles empty database gracefully", async () => {
      const result = await migration.migrateAll();

      expect(result.migrated).toBe(true);
      expect(result.errors).toHaveLength(0);

      // All counts should be 0
      for (const count of Object.values(result.counts)) {
        expect(count).toBe(0);
      }
    });
  });

  describe("verifyMigration", () => {
    it("returns true when counts match", async () => {
      await db.plantInstances.add(makePlant());
      await db.journalEntries.add(makeJournalEntry());
      await db.tasks.add(makeTask());

      await migration.migrateAll();

      const verified = await migration.verifyMigration();
      expect(verified).toBe(true);
    });

    it("returns true for empty databases", async () => {
      await migration.migrateAll();

      const verified = await migration.verifyMigration();
      expect(verified).toBe(true);
    });

    it("returns false when PouchDB has fewer records", async () => {
      const plant1 = makePlant();
      const plant2 = makePlant({ species: "Basil" });
      await db.plantInstances.add(plant1);
      await db.plantInstances.add(plant2);

      // Migrate only one
      await testPouchDB.put({
        _id: `plant:${plant1.id}`,
        docType: "plant",
        ...plant1,
      });

      const verified = await migration.verifyMigration();
      expect(verified).toBe(false);
    });
  });

  describe("cleanupDexie", () => {
    it("deletes the Dexie database", async () => {
      await db.plantInstances.add(makePlant());

      await migration.cleanupDexie();

      // After cleanup and re-open, data should be gone
      await db.open();
      const count = await db.plantInstances.count();
      expect(count).toBe(0);
    });
  });
});
