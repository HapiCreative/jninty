import { describe, it, expect, beforeEach, vi } from "vitest";
import PouchDB from "pouchdb";
import PouchDBFind from "pouchdb-find";
import PouchDBAdapterMemory from "pouchdb-adapter-memory";
import { formatISO, addDays, subDays, startOfDay } from "date-fns";

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(PouchDBAdapterMemory);

let testDB: PouchDB.Database;

vi.mock("../client.ts", () => ({
  get localDB() {
    return testDB;
  },
}));

const taskRepo = await import("./taskRepository.ts");

const PLANT_1 = crypto.randomUUID();
const PLANT_2 = crypto.randomUUID();
const SEASON_1 = crypto.randomUUID();
const SEASON_2 = crypto.randomUUID();

function todayDate(): string {
  return formatISO(startOfDay(new Date()), { representation: "date" });
}

const baseTask = {
  title: "Water the garden",
  dueDate: todayDate(),
  priority: "normal" as const,
  isCompleted: false,
};

beforeEach(async () => {
  testDB = new PouchDB(`test-task-${crypto.randomUUID()}`, {
    adapter: "memory",
  });
});

describe("PouchDB taskRepository", () => {
  describe("create", () => {
    it("creates a task with auto-generated fields", async () => {
      const task = await taskRepo.create(baseTask);

      expect(task.id).toBeDefined();
      expect(task.version).toBe(1);
      expect(task.title).toBe("Water the garden");
      expect(task.isCompleted).toBe(false);
    });
  });

  describe("complete / uncomplete", () => {
    it("marks a task as completed", async () => {
      const task = await taskRepo.create(baseTask);
      const completed = await taskRepo.complete(task.id);

      expect(completed.isCompleted).toBe(true);
      expect(completed.completedAt).toBeDefined();
      expect(completed.version).toBe(2);
    });

    it("uncompletes a task", async () => {
      const task = await taskRepo.create(baseTask);
      await taskRepo.complete(task.id);
      const uncompleted = await taskRepo.uncomplete(task.id);

      expect(uncompleted.isCompleted).toBe(false);
      expect(uncompleted.completedAt).toBeUndefined();
    });
  });

  describe("getUpcoming", () => {
    it("returns tasks due within the specified days", async () => {
      await taskRepo.create(baseTask);
      await taskRepo.create({
        ...baseTask,
        title: "Future task",
        dueDate: formatISO(addDays(new Date(), 3), {
          representation: "date",
        }),
      });
      await taskRepo.create({
        ...baseTask,
        title: "Far future",
        dueDate: formatISO(addDays(new Date(), 30), {
          representation: "date",
        }),
      });

      const upcoming = await taskRepo.getUpcoming(7);
      expect(upcoming).toHaveLength(2);
    });

    it("excludes completed tasks", async () => {
      const task = await taskRepo.create(baseTask);
      await taskRepo.complete(task.id);

      const upcoming = await taskRepo.getUpcoming(7);
      expect(upcoming).toHaveLength(0);
    });
  });

  describe("getOverdue", () => {
    it("returns incomplete tasks past due date", async () => {
      await taskRepo.create({
        ...baseTask,
        title: "Overdue",
        dueDate: formatISO(subDays(new Date(), 2), {
          representation: "date",
        }),
      });
      await taskRepo.create(baseTask); // today's task — not overdue

      const overdue = await taskRepo.getOverdue();
      expect(overdue).toHaveLength(1);
      expect(overdue[0]?.title).toBe("Overdue");
    });
  });

  describe("getByPlantId", () => {
    it("returns tasks for a specific plant", async () => {
      await taskRepo.create({
        ...baseTask,
        plantInstanceId: PLANT_1,
      });
      await taskRepo.create({
        ...baseTask,
        plantInstanceId: PLANT_2,
      });

      const tasks = await taskRepo.getByPlantId(PLANT_1);
      expect(tasks).toHaveLength(1);
    });
  });

  describe("getBySeasonId", () => {
    it("returns tasks for a specific season", async () => {
      await taskRepo.create({
        ...baseTask,
        seasonId: SEASON_1,
      });
      await taskRepo.create({
        ...baseTask,
        seasonId: SEASON_2,
      });

      const tasks = await taskRepo.getBySeasonId(SEASON_1);
      expect(tasks).toHaveLength(1);
    });
  });

  describe("getByDateRange", () => {
    it("returns only tasks within the date range", async () => {
      await taskRepo.create({ ...baseTask, title: "Before", dueDate: "2026-03-01" });
      await taskRepo.create({ ...baseTask, title: "Inside", dueDate: "2026-03-15" });
      await taskRepo.create({ ...baseTask, title: "After", dueDate: "2026-04-05" });

      const results = await taskRepo.getByDateRange("2026-03-01", "2026-03-31");
      expect(results).toHaveLength(2);
      expect(results.map((t) => t.title).sort()).toEqual(["Before", "Inside"]);
    });

    it("excludes completed tasks", async () => {
      const task = await taskRepo.create({ ...baseTask, dueDate: "2026-03-15" });
      await taskRepo.complete(task.id);

      const results = await taskRepo.getByDateRange("2026-03-01", "2026-03-31");
      expect(results).toHaveLength(0);
    });
  });

  describe("softDelete", () => {
    it("hides task from all queries", async () => {
      const task = await taskRepo.create(baseTask);
      await taskRepo.softDelete(task.id);

      expect(await taskRepo.getById(task.id)).toBeUndefined();
      const all = await taskRepo.getAll();
      expect(all).toHaveLength(0);
    });
  });
});
