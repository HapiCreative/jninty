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

const repo = await import("./scheduleTaskRepository.ts");

const PS_1 = "00000000-0000-0000-0000-000000000001";
const PS_2 = "00000000-0000-0000-0000-000000000002";

const baseInput = {
  plantingScheduleId: PS_1,
  taskType: "harvest" as const,
  title: "Harvest Tomato",
  scheduledDate: "2026-06-30",
  originalDate: "2026-06-30",
  sequenceOrder: 4,
  cropName: "Tomato",
  varietyName: "Cherry",
  isCompleted: false,
};

beforeEach(async () => {
  testDB = new PouchDB(`test-schedtask-${crypto.randomUUID()}`, {
    adapter: "memory",
  });
});

describe("scheduleTaskRepository", () => {
  describe("create", () => {
    it("creates a schedule task with auto-generated fields", async () => {
      const task = await repo.create(baseInput);
      expect(task.id).toBeDefined();
      expect(task.version).toBe(1);
      expect(task.title).toBe("Harvest Tomato");
      expect(task.isCompleted).toBe(false);
      expect(task.deletedAt).toBeUndefined();
    });
  });

  describe("createBatch", () => {
    it("creates multiple tasks atomically", async () => {
      const tasks = await repo.createBatch([
        { ...baseInput, title: "Task 1", sequenceOrder: 0, taskType: "seed_start" as const },
        { ...baseInput, title: "Task 2", sequenceOrder: 1, taskType: "transplant" as const },
      ]);
      expect(tasks).toHaveLength(2);
      expect(tasks[0]!.title).toBe("Task 1");
      expect(tasks[1]!.title).toBe("Task 2");
    });
  });

  describe("update", () => {
    it("updates a task and increments version", async () => {
      const task = await repo.create(baseInput);
      const updated = await repo.update(task.id, { scheduledDate: "2026-07-15" });
      expect(updated.scheduledDate).toBe("2026-07-15");
      expect(updated.version).toBe(2);
    });

    it("throws for nonexistent task", async () => {
      await expect(repo.update("nonexistent", { title: "x" })).rejects.toThrow("not found");
    });
  });

  describe("complete / uncomplete", () => {
    it("marks a task as completed", async () => {
      const task = await repo.create(baseInput);
      const completed = await repo.complete(task.id, "2026-07-01");
      expect(completed.isCompleted).toBe(true);
      expect(completed.completedDate).toBe("2026-07-01");
      expect(completed.completedAt).toBeDefined();
    });

    it("uncompletes a task", async () => {
      const task = await repo.create(baseInput);
      await repo.complete(task.id, "2026-07-01");
      const uncompleted = await repo.uncomplete(task.id);
      expect(uncompleted.isCompleted).toBe(false);
      expect(uncompleted.completedDate).toBeUndefined();
    });
  });

  describe("softDelete", () => {
    it("soft-deletes a task", async () => {
      const task = await repo.create(baseInput);
      await repo.softDelete(task.id);
      const fetched = await repo.getById(task.id);
      expect(fetched).toBeUndefined();
    });
  });

  describe("getById", () => {
    it("returns a task by id", async () => {
      const task = await repo.create(baseInput);
      const fetched = await repo.getById(task.id);
      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(task.id);
    });

    it("returns undefined for nonexistent id", async () => {
      const fetched = await repo.getById("nonexistent");
      expect(fetched).toBeUndefined();
    });

    it("returns undefined for soft-deleted task", async () => {
      const task = await repo.create(baseInput);
      await repo.softDelete(task.id);
      expect(await repo.getById(task.id)).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("returns all non-deleted tasks", async () => {
      await repo.create({ ...baseInput, title: "A" });
      const toDelete = await repo.create({ ...baseInput, title: "B" });
      await repo.create({ ...baseInput, title: "C" });
      await repo.softDelete(toDelete.id);

      const all = await repo.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe("getByScheduleId", () => {
    it("returns tasks for a specific planting schedule", async () => {
      await repo.create({ ...baseInput, plantingScheduleId: PS_1 });
      await repo.create({ ...baseInput, plantingScheduleId: PS_2 });
      await repo.create({ ...baseInput, plantingScheduleId: PS_1, title: "Another" });

      const results = await repo.getByScheduleId(PS_1);
      expect(results).toHaveLength(2);
    });

    it("returns tasks sorted by sequenceOrder", async () => {
      await repo.create({ ...baseInput, sequenceOrder: 4, taskType: "harvest" as const });
      await repo.create({ ...baseInput, sequenceOrder: 0, taskType: "seed_start" as const, title: "Seed" });
      await repo.create({ ...baseInput, sequenceOrder: 2, taskType: "transplant" as const, title: "Transplant" });

      const results = await repo.getByScheduleId(PS_1);
      expect(results.map((t) => t.sequenceOrder)).toEqual([0, 2, 4]);
    });
  });

  describe("getByDateRange", () => {
    it("returns tasks within the date range", async () => {
      await repo.create({ ...baseInput, scheduledDate: "2026-06-01", originalDate: "2026-06-01" });
      await repo.create({ ...baseInput, scheduledDate: "2026-06-15", originalDate: "2026-06-15" });
      await repo.create({ ...baseInput, scheduledDate: "2026-07-15", originalDate: "2026-07-15" });

      const results = await repo.getByDateRange("2026-06-01", "2026-06-30");
      expect(results).toHaveLength(2);
    });
  });

  describe("getIncompleteDownstream", () => {
    it("returns incomplete tasks after the given sequence order", async () => {
      await repo.create({ ...baseInput, sequenceOrder: 0, taskType: "seed_start" as const, title: "Seed" });
      await repo.create({ ...baseInput, sequenceOrder: 2, taskType: "transplant" as const, title: "Transplant" });
      await repo.create({ ...baseInput, sequenceOrder: 4, taskType: "harvest" as const, title: "Harvest" });

      const downstream = await repo.getIncompleteDownstream(PS_1, 0);
      expect(downstream).toHaveLength(2);
      expect(downstream.map((t) => t.sequenceOrder)).toEqual([2, 4]);
    });
  });

  describe("softDeleteByScheduleId", () => {
    it("soft-deletes all tasks for a schedule", async () => {
      await repo.create({ ...baseInput, plantingScheduleId: PS_1 });
      await repo.create({ ...baseInput, plantingScheduleId: PS_1, title: "Another" });
      await repo.create({ ...baseInput, plantingScheduleId: PS_2, title: "Other" });

      await repo.softDeleteByScheduleId(PS_1);

      const ps1Tasks = await repo.getByScheduleId(PS_1);
      expect(ps1Tasks).toHaveLength(0);

      const ps2Tasks = await repo.getByScheduleId(PS_2);
      expect(ps2Tasks).toHaveLength(1);
    });
  });

  describe("updateBatch", () => {
    it("updates multiple tasks", async () => {
      const t1 = await repo.create({ ...baseInput, title: "Task 1", sequenceOrder: 0, taskType: "seed_start" as const });
      const t2 = await repo.create({ ...baseInput, title: "Task 2", sequenceOrder: 1, taskType: "transplant" as const });

      const updated = await repo.updateBatch([
        { id: t1.id, changes: { scheduledDate: "2026-07-01" } },
        { id: t2.id, changes: { scheduledDate: "2026-07-15" } },
      ]);

      expect(updated).toHaveLength(2);
      expect(updated[0]!.scheduledDate).toBe("2026-07-01");
      expect(updated[1]!.scheduledDate).toBe("2026-07-15");

      // Verify persisted
      const fetched1 = await repo.getById(t1.id);
      const fetched2 = await repo.getById(t2.id);
      expect(fetched1!.scheduledDate).toBe("2026-07-01");
      expect(fetched2!.scheduledDate).toBe("2026-07-15");
    });

    it("throws if any task not found", async () => {
      await expect(
        repo.updateBatch([{ id: "nonexistent", changes: { scheduledDate: "2026-07-01" } }]),
      ).rejects.toThrow("ScheduleTask not found");
    });
  });
});
