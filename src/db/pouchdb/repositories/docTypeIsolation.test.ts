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

const plantRepo = await import("./plantRepository.ts");
const journalRepo = await import("./journalRepository.ts");
const taskRepo = await import("./taskRepository.ts");
const seedRepo = await import("./seedRepository.ts");
const expenseRepo = await import("./expenseRepository.ts");

const SEASON_ID = crypto.randomUUID();

beforeEach(async () => {
  testDB = new PouchDB(`test-isolation-${crypto.randomUUID()}`, {
    adapter: "memory",
  });
});

describe("PouchDB docType isolation", () => {
  it("different entity types share the same DB but are isolated in queries", async () => {
    // Create documents of different types
    await plantRepo.create({
      species: "Tomato",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    await journalRepo.create({
      seasonId: SEASON_ID,
      activityType: "watering",
      body: "Watered",
      photoIds: [] as string[],
      isMilestone: false,
    });

    await taskRepo.create({
      title: "Task 1",
      dueDate: "2026-06-01",
      priority: "normal",
      isCompleted: false,
    });

    await seedRepo.create({
      name: "Basil Seeds",
      species: "Basil",
      quantityRemaining: 10,
      quantityUnit: "packets",
    });

    await expenseRepo.create({
      name: "Garden hose",
      category: "tools",
      amount: 25,
      date: "2026-06-01",
    });

    // Verify each repository only returns its own type
    const plants = await plantRepo.getAll();
    expect(plants).toHaveLength(1);
    expect(plants[0]?.species).toBe("Tomato");

    const journals = await journalRepo.getAll();
    expect(journals).toHaveLength(1);
    expect(journals[0]?.body).toBe("Watered");

    const tasks = await taskRepo.getAll();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe("Task 1");

    const seeds = await seedRepo.getAll();
    expect(seeds).toHaveLength(1);
    expect(seeds[0]?.name).toBe("Basil Seeds");

    const expenses = await expenseRepo.getAll();
    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.name).toBe("Garden hose");

    // Verify total documents in DB is 5
    const allDocs = await testDB.allDocs();
    const dataDocs = allDocs.rows.filter(
      (r) => !r.id.startsWith("_design/"),
    );
    expect(dataDocs).toHaveLength(5);
  });

  it("soft-deleting one type doesn't affect others", async () => {
    const plant = await plantRepo.create({
      species: "Tomato",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    await journalRepo.create({
      seasonId: SEASON_ID,
      activityType: "watering",
      body: "Watered",
      photoIds: [] as string[],
      isMilestone: false,
    });

    await plantRepo.softDelete(plant.id);

    // Plants should be empty
    expect(await plantRepo.getAll()).toHaveLength(0);

    // Journals should still be there
    expect(await journalRepo.getAll()).toHaveLength(1);
  });
});
