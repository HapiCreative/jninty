import { db } from "../schema.ts";
import {
  expenseSchema,
  type Expense,
} from "../../validation/expense.schema.ts";

type CreateExpenseInput = Omit<
  Expense,
  "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"
>;

type UpdateExpenseInput = Partial<CreateExpenseInput>;

function now(): string {
  return new Date().toISOString();
}

export async function create(input: CreateExpenseInput): Promise<Expense> {
  const timestamp = now();
  const record: Expense = {
    ...input,
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const parsed = expenseSchema.parse(record);
  await db.expenses.add(parsed);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdateExpenseInput,
): Promise<Expense> {
  const existing = await db.expenses.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`Expense not found: ${id}`);
  }

  const updated: Expense = {
    ...existing,
    ...changes,
    id: existing.id,
    version: existing.version + 1,
    createdAt: existing.createdAt,
    updatedAt: now(),
  };

  const parsed = expenseSchema.parse(updated);
  await db.expenses.put(parsed);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const existing = await db.expenses.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`Expense not found: ${id}`);
  }

  const timestamp = now();
  const deleted = expenseSchema.parse({
    ...existing,
    deletedAt: timestamp,
    updatedAt: timestamp,
    version: existing.version + 1,
  });
  await db.expenses.put(deleted);
}

export async function getById(id: string): Promise<Expense | undefined> {
  const record = await db.expenses.get(id);
  if (!record || record.deletedAt != null) return undefined;
  return record;
}

export async function getAll(): Promise<Expense[]> {
  const records = await db.expenses.toArray();
  return records.filter((r) => r.deletedAt == null);
}

export async function getBySeason(seasonId: string): Promise<Expense[]> {
  const records = await db.expenses
    .where("seasonId")
    .equals(seasonId)
    .toArray();
  return records.filter((r) => r.deletedAt == null);
}
