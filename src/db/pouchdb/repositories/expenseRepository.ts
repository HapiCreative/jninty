import { localDB } from "../client.ts";
import { type PouchDoc, stripPouchFields, toPouchDoc } from "../utils.ts";
import {
  expenseSchema,
  type Expense,
} from "../../../validation/expense.schema.ts";
import { ensureAllIndexes } from "../indexes.ts";

const DOC_TYPE = "expense";

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
  const doc = toPouchDoc(parsed, DOC_TYPE);
  await localDB.put(doc);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdateExpenseInput,
): Promise<Expense> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<Expense>;
  try {
    existing = await localDB.get<PouchDoc<Expense>>(docId);
  } catch {
    throw new Error(`Expense not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`Expense not found: ${id}`);
  }

  const updated: Expense = {
    ...entity,
    ...changes,
    id: entity.id,
    version: entity.version + 1,
    createdAt: entity.createdAt,
    updatedAt: now(),
  };

  const parsed = expenseSchema.parse(updated);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  doc._rev = existing._rev;
  await localDB.put(doc);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<Expense>;
  try {
    existing = await localDB.get<PouchDoc<Expense>>(docId);
  } catch {
    throw new Error(`Expense not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`Expense not found: ${id}`);
  }

  const timestamp = now();
  const deleted = expenseSchema.parse({
    ...entity,
    deletedAt: timestamp,
    updatedAt: timestamp,
    version: entity.version + 1,
  });

  const doc = toPouchDoc(deleted, DOC_TYPE);
  doc._rev = existing._rev;
  await localDB.put(doc);
}

export async function getById(id: string): Promise<Expense | undefined> {
  const docId = `${DOC_TYPE}:${id}`;
  try {
    const doc = await localDB.get<PouchDoc<Expense>>(docId);
    const entity = stripPouchFields(doc);
    if (entity.deletedAt != null) return undefined;
    return entity;
  } catch {
    return undefined;
  }
}

export async function getAll(): Promise<Expense[]> {
  await ensureAllIndexes();
  const result = await localDB.find({
    selector: { docType: DOC_TYPE },
  });
  return (result.docs as PouchDoc<Expense>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}

export async function getBySeason(seasonId: string): Promise<Expense[]> {
  await ensureAllIndexes();
  const result = await localDB.find({
    selector: {
      docType: DOC_TYPE,
      seasonId,
    },
  });
  return (result.docs as PouchDoc<Expense>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}
