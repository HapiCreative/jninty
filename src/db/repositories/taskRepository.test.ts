import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { formatISO, addDays, subDays, startOfDay } from "date-fns";
import { db } from "../schema.ts";
import * as taskRepo from "./taskRepository.ts";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => {
  vi.useRealTimers();
});

function dateStr(date: Date): string {
  return formatISO(startOfDay(date), { representation: "date" });
}

const today = dateStr(new Date());

const baseTask = {
  title: "Water tomatoes",
  dueDate: today,
  priority: "normal" as const,
  isCompleted: false,
};

describe("taskRepository", () => {
  describe("create", () => {
    it("creates a task with auto-generated fields", async () => {
      const task = await taskRepo.create(baseTask);

      expect(task.id).toBeDefined();
      expect(task.version).toBe(1);
      expect(task.title).toBe("Water tomatoes");
      expect(task.isCompleted).toBe(false);
    });

    it("creates a task with optional fields", async () => {
      const task = await taskRepo.create({
        ...baseTask,
        description: "Use drip irrigation",
        plantInstanceId: "00000000-0000-0000-0000-000000000001",
      });

      expect(task.description).toBe("Use drip irrigation");
      expect(task.plantInstanceId).toBe(
        "00000000-0000-0000-0000-000000000001",
      );
    });
  });

  describe("update", () => {
    it("increments version and updates fields", async () => {
      const task = await taskRepo.create(baseTask);
      const updated = await taskRepo.update(task.id, {
        title: "Water all plants",
        priority: "urgent",
      });

      expect(updated.version).toBe(2);
      expect(updated.title).toBe("Water all plants");
      expect(updated.priority).toBe("urgent");
    });

    it("throws when updating a non-existent task", async () => {
      await expect(
        taskRepo.update("00000000-0000-0000-0000-000000000000", {
          title: "Nope",
        }),
      ).rejects.toThrow("Task not found");
    });
  });

  describe("complete", () => {
    it("marks a task as completed with timestamp", async () => {
      const task = await taskRepo.create(baseTask);
      const completed = await taskRepo.complete(task.id);

      expect(completed.isCompleted).toBe(true);
      expect(completed.completedAt).toBeDefined();
      expect(completed.version).toBe(2);
    });

    it("throws when completing a soft-deleted task", async () => {
      const task = await taskRepo.create(baseTask);
      await taskRepo.softDelete(task.id);

      await expect(taskRepo.complete(task.id)).rejects.toThrow(
        "Task not found",
      );
    });
  });

  describe("softDelete", () => {
    it("sets deletedAt", async () => {
      const task = await taskRepo.create(baseTask);
      await taskRepo.softDelete(task.id);

      const raw = await db.tasks.get(task.id);
      expect(raw?.deletedAt).toBeDefined();
    });
  });

  describe("getById", () => {
    it("returns a task by id", async () => {
      const task = await taskRepo.create(baseTask);
      const found = await taskRepo.getById(task.id);
      expect(found?.id).toBe(task.id);
    });

    it("returns undefined for soft-deleted tasks", async () => {
      const task = await taskRepo.create(baseTask);
      await taskRepo.softDelete(task.id);
      expect(await taskRepo.getById(task.id)).toBeUndefined();
    });
  });

  describe("getUpcoming", () => {
    it("returns tasks due within the next N days", async () => {
      await taskRepo.create({
        ...baseTask,
        dueDate: dateStr(addDays(new Date(), 2)),
      });
      await taskRepo.create({
        ...baseTask,
        dueDate: dateStr(addDays(new Date(), 10)),
        title: "Far future",
      });

      const upcoming = await taskRepo.getUpcoming(7);
      expect(upcoming).toHaveLength(1);
    });

    it("excludes completed tasks", async () => {
      const task = await taskRepo.create({
        ...baseTask,
        dueDate: dateStr(addDays(new Date(), 1)),
      });
      await taskRepo.complete(task.id);

      const upcoming = await taskRepo.getUpcoming(7);
      expect(upcoming).toHaveLength(0);
    });

    it("includes tasks due today", async () => {
      await taskRepo.create(baseTask); // due today

      const upcoming = await taskRepo.getUpcoming(7);
      expect(upcoming).toHaveLength(1);
    });
  });

  describe("getOverdue", () => {
    it("returns incomplete tasks past their due date", async () => {
      await taskRepo.create({
        ...baseTask,
        dueDate: dateStr(subDays(new Date(), 3)),
        title: "Overdue task",
      });
      await taskRepo.create(baseTask); // due today, not overdue

      const overdue = await taskRepo.getOverdue();
      expect(overdue).toHaveLength(1);
      expect(overdue[0]?.title).toBe("Overdue task");
    });

    it("excludes completed overdue tasks", async () => {
      const task = await taskRepo.create({
        ...baseTask,
        dueDate: dateStr(subDays(new Date(), 1)),
      });
      await taskRepo.complete(task.id);

      const overdue = await taskRepo.getOverdue();
      expect(overdue).toHaveLength(0);
    });
  });

  describe("getByPlantId", () => {
    it("returns tasks for a specific plant", async () => {
      const plantId = "00000000-0000-0000-0000-000000000001";
      await taskRepo.create({
        ...baseTask,
        plantInstanceId: plantId,
      });
      await taskRepo.create(baseTask); // no plant

      const results = await taskRepo.getByPlantId(plantId);
      expect(results).toHaveLength(1);
    });
  });
});
