import { addDays, formatISO, startOfDay } from "date-fns";
import { db } from "../schema.ts";
import { taskSchema, type Task } from "../../validation/task.schema.ts";

type CreateTaskInput = Omit<
  Task,
  "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"
>;

type UpdateTaskInput = Partial<CreateTaskInput>;

function now(): string {
  return new Date().toISOString();
}

function todayDate(): string {
  return formatISO(startOfDay(new Date()), { representation: "date" });
}

export async function create(input: CreateTaskInput): Promise<Task> {
  const timestamp = now();
  const record: Task = {
    ...input,
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const parsed = taskSchema.parse(record);
  await db.tasks.add(parsed);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdateTaskInput,
): Promise<Task> {
  const existing = await db.tasks.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`Task not found: ${id}`);
  }

  const updated: Task = {
    ...existing,
    ...changes,
    id: existing.id,
    version: existing.version + 1,
    createdAt: existing.createdAt,
    updatedAt: now(),
  };

  const parsed = taskSchema.parse(updated);
  await db.tasks.put(parsed);
  return parsed;
}

export async function complete(id: string): Promise<Task> {
  const existing = await db.tasks.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`Task not found: ${id}`);
  }

  const timestamp = now();
  const updated: Task = {
    ...existing,
    isCompleted: true,
    completedAt: timestamp,
    version: existing.version + 1,
    updatedAt: timestamp,
  };

  const parsed = taskSchema.parse(updated);
  await db.tasks.put(parsed);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const existing = await db.tasks.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`Task not found: ${id}`);
  }

  const timestamp = now();
  const deleted = taskSchema.parse({
    ...existing,
    deletedAt: timestamp,
    updatedAt: timestamp,
    version: existing.version + 1,
  });
  await db.tasks.put(deleted);
}

export async function getById(id: string): Promise<Task | undefined> {
  const record = await db.tasks.get(id);
  if (!record || record.deletedAt != null) return undefined;
  return record;
}

export async function getUpcoming(days: number): Promise<Task[]> {
  const today = todayDate();
  const future = formatISO(addDays(new Date(), days), {
    representation: "date",
  });

  const records = await db.tasks
    .where("dueDate")
    .between(today, future, true, true)
    .toArray();

  return records.filter((r) => r.deletedAt == null && !r.isCompleted);
}

export async function getOverdue(): Promise<Task[]> {
  const today = todayDate();

  const records = await db.tasks
    .where("dueDate")
    .below(today)
    .toArray();

  return records.filter((r) => r.deletedAt == null && !r.isCompleted);
}

export async function getAll(): Promise<Task[]> {
  const records = await db.tasks.toArray();
  return records.filter((r) => r.deletedAt == null);
}

export async function uncomplete(id: string): Promise<Task> {
  const existing = await db.tasks.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`Task not found: ${id}`);
  }

  const updated = taskSchema.parse({
    ...existing,
    isCompleted: false,
    completedAt: undefined,
    version: existing.version + 1,
    updatedAt: now(),
  });

  await db.tasks.put(updated);
  return updated;
}

// Full table scan — plantInstanceId is not indexed for tasks per design doc
// section 5.5. Acceptable for Phase 1 dataset sizes; add an index if needed.
export async function getByPlantId(
  plantInstanceId: string,
): Promise<Task[]> {
  const records = await db.tasks.toArray();
  return records.filter(
    (r) =>
      r.deletedAt == null && r.plantInstanceId === plantInstanceId,
  );
}
