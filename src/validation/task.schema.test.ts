import { describe, it, expect } from "vitest";
import { taskSchema } from "./task.schema.ts";
import { validateEntity } from "./helpers.ts";

const validTask = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  version: 0,
  createdAt: "2026-03-15T14:30:00Z",
  updatedAt: "2026-03-15T14:30:00Z",
  title: "Water the tomatoes",
  dueDate: "2026-03-20",
  priority: "normal" as const,
  isCompleted: false,
};

describe("taskSchema", () => {
  it("accepts valid minimal task", () => {
    const result = validateEntity(taskSchema, validTask);
    expect(result.success).toBe(true);
  });

  it("accepts task with all optional fields", () => {
    const full = {
      ...validTask,
      description: "Deep water at the base",
      plantInstanceId: "660e8400-e29b-41d4-a716-446655440001",
      bedId: "770e8400-e29b-41d4-a716-446655440002",
      isCompleted: true,
      completedAt: "2026-03-20T08:00:00Z",
      recurrence: {
        type: "weekly" as const,
        interval: 1,
      },
    };
    const result = validateEntity(taskSchema, full);
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = validateEntity(taskSchema, {
      ...validTask,
      title: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing dueDate", () => {
    const { dueDate: _, ...noDue } = validTask;
    const result = validateEntity(taskSchema, noDue);
    expect(result.success).toBe(false);
  });

  it("rejects invalid priority", () => {
    const result = validateEntity(taskSchema, {
      ...validTask,
      priority: "critical",
    });
    expect(result.success).toBe(false);
  });

  it("validates all priority levels", () => {
    for (const priority of ["urgent", "normal", "low"]) {
      const result = validateEntity(taskSchema, {
        ...validTask,
        priority,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects zero recurrence interval", () => {
    const result = validateEntity(taskSchema, {
      ...validTask,
      recurrence: { type: "daily", interval: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative recurrence interval", () => {
    const result = validateEntity(taskSchema, {
      ...validTask,
      recurrence: { type: "weekly", interval: -1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects fractional recurrence interval", () => {
    const result = validateEntity(taskSchema, {
      ...validTask,
      recurrence: { type: "monthly", interval: 1.5 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid recurrence type", () => {
    const result = validateEntity(taskSchema, {
      ...validTask,
      recurrence: { type: "yearly", interval: 1 },
    });
    expect(result.success).toBe(false);
  });

  it("validates all recurrence types", () => {
    for (const type of ["daily", "weekly", "monthly", "custom"]) {
      const result = validateEntity(taskSchema, {
        ...validTask,
        recurrence: { type, interval: 2 },
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects empty description", () => {
    const result = validateEntity(taskSchema, {
      ...validTask,
      description: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean isCompleted", () => {
    const result = validateEntity(taskSchema, {
      ...validTask,
      isCompleted: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown properties (strict mode)", () => {
    const result = validateEntity(taskSchema, {
      ...validTask,
      ruleId: "some-rule",
    });
    expect(result.success).toBe(false);
  });

  it("rejects datetime for dueDate (expects date only)", () => {
    const result = validateEntity(taskSchema, {
      ...validTask,
      dueDate: "2026-03-20T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown properties in recurrence (strict mode)", () => {
    const result = validateEntity(taskSchema, {
      ...validTask,
      recurrence: { type: "daily", interval: 1, extra: true },
    });
    expect(result.success).toBe(false);
  });
});
