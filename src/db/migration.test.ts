import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

// We test the migration by:
// 1. Creating a v1-only database and seeding Phase 1 data
// 2. Closing it
// 3. Opening it through JnintyDB (which declares v2) to trigger the upgrade
// 4. Verifying all data was migrated correctly

const TEST_DB_NAME = "jninty-migration-test";

async function seedV1Data() {
  // Create a minimal v1 database directly with Dexie
  const v1db = new Dexie(TEST_DB_NAME);
  v1db.version(1).stores({
    plantInstances: "id, species, type, status, *tags",
    journalEntries:
      "id, plantInstanceId, bedId, seasonId, activityType, createdAt",
    photos: "id, createdAt",
    tasks: "id, dueDate, isCompleted, seasonId",
    gardenBeds: "id",
    settings: "id",
    searchIndex: "id",
  });

  await v1db.open();

  const timestamp = "2026-03-01T10:00:00.000Z";

  // Seed plants
  await v1db.table("plantInstances").bulkAdd([
    {
      id: "11111111-1111-1111-1111-111111111111",
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      species: "Solanum lycopersicum",
      variety: "San Marzano",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: ["tomato"],
      dateAcquired: "2026-04-01",
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      species: "Malus domestica",
      variety: "Honeycrisp",
      type: "fruit_tree",
      isPerennial: true,
      source: "nursery",
      status: "active",
      tags: ["apple", "tree"],
    },
  ]);

  // Seed journal entries (no seasonId — should be back-filled)
  await v1db.table("journalEntries").bulkAdd([
    {
      id: "33333333-3333-3333-3333-333333333333",
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      plantInstanceId: "11111111-1111-1111-1111-111111111111",
      activityType: "watering",
      body: "Watered the tomatoes",
      photoIds: [],
      isMilestone: false,
    },
    {
      id: "44444444-4444-4444-4444-444444444444",
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      activityType: "general",
      body: "Garden looks good today",
      photoIds: [],
      isMilestone: false,
    },
  ]);

  // Seed tasks (no seasonId — should be back-filled)
  await v1db.table("tasks").bulkAdd([
    {
      id: "55555555-5555-5555-5555-555555555555",
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      title: "Water tomatoes",
      dueDate: "2026-03-15",
      priority: "normal",
      isCompleted: false,
      plantInstanceId: "11111111-1111-1111-1111-111111111111",
    },
    {
      id: "66666666-6666-6666-6666-666666666666",
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      title: "Prune apple tree",
      dueDate: "2026-03-20",
      priority: "low",
      isCompleted: true,
      completedAt: timestamp,
    },
  ]);

  v1db.close();
}

async function openAsV2() {
  // Import JnintyDB which defines version(2) with the upgrade
  const { JnintyDB } = await import("./schema.ts");
  const db = new JnintyDB(TEST_DB_NAME);
  await db.open();
  return db;
}

beforeEach(async () => {
  await Dexie.delete(TEST_DB_NAME);
});

afterEach(async () => {
  await Dexie.delete(TEST_DB_NAME);
});

describe("v1 → v2 migration", () => {
  it("creates a default season", async () => {
    await seedV1Data();
    const db = await openAsV2();

    const seasons = await db.table("seasons").toArray();
    expect(seasons).toHaveLength(1);

    const season = seasons[0];
    expect(season.name).toMatch(/Growing Season/);
    expect(season.year).toBe(new Date().getFullYear());
    expect(season.isActive).toBe(true);
    expect(season.startDate).toBeDefined();
    expect(season.endDate).toBeDefined();

    db.close();
  });

  it("creates a Planting for each PlantInstance", async () => {
    await seedV1Data();
    const db = await openAsV2();

    const plantings = await db.table("plantings").toArray();
    expect(plantings).toHaveLength(2);

    const seasons = await db.table("seasons").toArray();
    const seasonId = seasons[0].id;

    // Each planting links to the default season
    for (const planting of plantings) {
      expect(planting.seasonId).toBe(seasonId);
      expect(planting.plantInstanceId).toBeDefined();
    }

    // The tomato planting should carry over dateAcquired → datePlanted
    const tomatoPlanting = plantings.find(
      (p: Record<string, unknown>) =>
        p.plantInstanceId === "11111111-1111-1111-1111-111111111111",
    );
    expect(tomatoPlanting?.datePlanted).toBe("2026-04-01");

    // The apple tree has no dateAcquired, so datePlanted should be undefined
    const applePlanting = plantings.find(
      (p: Record<string, unknown>) =>
        p.plantInstanceId === "22222222-2222-2222-2222-222222222222",
    );
    expect(applePlanting?.datePlanted).toBeUndefined();

    db.close();
  });

  it("back-fills seasonId on all JournalEntries", async () => {
    await seedV1Data();
    const db = await openAsV2();

    const entries = await db.table("journalEntries").toArray();
    const seasons = await db.table("seasons").toArray();
    const seasonId = seasons[0].id;

    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(entry.seasonId).toBe(seasonId);
    }

    db.close();
  });

  it("back-fills seasonId on all Tasks", async () => {
    await seedV1Data();
    const db = await openAsV2();

    const tasks = await db.table("tasks").toArray();
    const seasons = await db.table("seasons").toArray();
    const seasonId = seasons[0].id;

    expect(tasks).toHaveLength(2);
    for (const task of tasks) {
      expect(task.seasonId).toBe(seasonId);
    }

    db.close();
  });

  it("preserves existing PlantInstance data untouched", async () => {
    await seedV1Data();
    const db = await openAsV2();

    const plants = await db.table("plantInstances").toArray();
    expect(plants).toHaveLength(2);

    const tomato = plants.find(
      (p: Record<string, unknown>) =>
        p.id === "11111111-1111-1111-1111-111111111111",
    );
    expect(tomato?.species).toBe("Solanum lycopersicum");
    expect(tomato?.variety).toBe("San Marzano");
    expect(tomato?.tags).toEqual(["tomato"]);

    db.close();
  });

  it("handles empty database gracefully", async () => {
    // Seed an empty v1 database (no data)
    const v1db = new Dexie(TEST_DB_NAME);
    v1db.version(1).stores({
      plantInstances: "id, species, type, status, *tags",
      journalEntries:
        "id, plantInstanceId, bedId, seasonId, activityType, createdAt",
      photos: "id, createdAt",
      tasks: "id, dueDate, isCompleted, seasonId",
      gardenBeds: "id",
      settings: "id",
      searchIndex: "id",
    });
    await v1db.open();
    v1db.close();

    const db = await openAsV2();

    const seasons = await db.table("seasons").toArray();
    expect(seasons).toHaveLength(1); // Default season always created

    const plantings = await db.table("plantings").toArray();
    expect(plantings).toHaveLength(0); // No plants → no plantings

    db.close();
  });

  it("does not duplicate seasonId if already set on journal entries", async () => {
    // Create v1 DB with a journal entry that already has a seasonId
    const v1db = new Dexie(TEST_DB_NAME);
    v1db.version(1).stores({
      plantInstances: "id, species, type, status, *tags",
      journalEntries:
        "id, plantInstanceId, bedId, seasonId, activityType, createdAt",
      photos: "id, createdAt",
      tasks: "id, dueDate, isCompleted, seasonId",
      gardenBeds: "id",
      settings: "id",
      searchIndex: "id",
    });
    await v1db.open();

    const existingSeasonId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    await v1db.table("journalEntries").add({
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      version: 1,
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T10:00:00.000Z",
      activityType: "general",
      body: "Pre-existing season entry",
      photoIds: [],
      isMilestone: false,
      seasonId: existingSeasonId,
    });
    v1db.close();

    const db = await openAsV2();
    const entries = await db.table("journalEntries").toArray();
    expect(entries).toHaveLength(1);
    // Should keep the existing seasonId, not overwrite it
    expect(entries[0].seasonId).toBe(existingSeasonId);

    db.close();
  });
});
