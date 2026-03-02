import { localDB } from "../client.ts";
import { type PouchDoc, stripPouchFields, toPouchDoc } from "../utils.ts";
import { seedSchema, type Seed } from "../../../validation/seed.schema.ts";
import { ensureAllIndexes } from "../indexes.ts";

const DOC_TYPE = "seed";

type CreateSeedInput = Omit<
  Seed,
  "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"
>;

type UpdateSeedInput = Partial<CreateSeedInput>;

function now(): string {
  return new Date().toISOString();
}

export async function create(input: CreateSeedInput): Promise<Seed> {
  const timestamp = now();
  const record: Seed = {
    ...input,
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const parsed = seedSchema.parse(record);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  await localDB.put(doc);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdateSeedInput,
): Promise<Seed> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<Seed>;
  try {
    existing = await localDB.get<PouchDoc<Seed>>(docId);
  } catch {
    throw new Error(`Seed not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`Seed not found: ${id}`);
  }

  const updated: Seed = {
    ...entity,
    ...changes,
    id: entity.id,
    version: entity.version + 1,
    createdAt: entity.createdAt,
    updatedAt: now(),
  };

  const parsed = seedSchema.parse(updated);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  doc._rev = existing._rev;
  await localDB.put(doc);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<Seed>;
  try {
    existing = await localDB.get<PouchDoc<Seed>>(docId);
  } catch {
    throw new Error(`Seed not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`Seed not found: ${id}`);
  }

  const timestamp = now();
  const deleted = seedSchema.parse({
    ...entity,
    deletedAt: timestamp,
    updatedAt: timestamp,
    version: entity.version + 1,
  });

  const doc = toPouchDoc(deleted, DOC_TYPE);
  doc._rev = existing._rev;
  await localDB.put(doc);
}

export async function getById(id: string): Promise<Seed | undefined> {
  const docId = `${DOC_TYPE}:${id}`;
  try {
    const doc = await localDB.get<PouchDoc<Seed>>(docId);
    const entity = stripPouchFields(doc);
    if (entity.deletedAt != null) return undefined;
    return entity;
  } catch {
    return undefined;
  }
}

export async function getAll(): Promise<Seed[]> {
  await ensureAllIndexes();
  const result = await localDB.find({
    selector: { docType: DOC_TYPE },
  });
  return (result.docs as PouchDoc<Seed>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}

export async function getBySpecies(species: string): Promise<Seed[]> {
  await ensureAllIndexes();
  const result = await localDB.find({
    selector: {
      docType: DOC_TYPE,
      species,
    },
  });
  return (result.docs as PouchDoc<Seed>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}

export async function getExpiringSoon(days: number): Promise<Seed[]> {
  await ensureAllIndexes();
  const today = new Date();
  const cutoff = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
  const todayDate = today.toISOString().split("T")[0]!;
  const cutoffDate = cutoff.toISOString().split("T")[0]!;

  const result = await localDB.find({
    selector: {
      docType: DOC_TYPE,
      expiryDate: { $gte: todayDate, $lte: cutoffDate },
    },
  });

  return (result.docs as PouchDoc<Seed>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}

/**
 * Deducts a quantity from a seed's remaining stock.
 * PouchDB doesn't have transactions, so we use optimistic concurrency
 * via _rev. If the doc was modified between read and write, PouchDB
 * will throw a 409 conflict and the caller can retry.
 */
export async function deductQuantity(
  id: string,
  amount: number,
): Promise<Seed> {
  if (amount <= 0) {
    throw new Error("Deduction amount must be positive");
  }

  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<Seed>;
  try {
    existing = await localDB.get<PouchDoc<Seed>>(docId);
  } catch {
    throw new Error(`Seed not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`Seed not found: ${id}`);
  }

  if (entity.quantityRemaining < amount) {
    throw new Error(
      `Insufficient quantity: ${String(entity.quantityRemaining)} remaining, tried to deduct ${String(amount)}`,
    );
  }

  const updated: Seed = {
    ...entity,
    quantityRemaining: entity.quantityRemaining - amount,
    version: entity.version + 1,
    updatedAt: now(),
  };

  const parsed = seedSchema.parse(updated);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  doc._rev = existing._rev;
  await localDB.put(doc);
  return parsed;
}
