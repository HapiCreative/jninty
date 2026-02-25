import { db } from "../schema.ts";
import { seedSchema, type Seed } from "../../validation/seed.schema.ts";

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
  await db.seeds.add(parsed);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdateSeedInput,
): Promise<Seed> {
  const existing = await db.seeds.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`Seed not found: ${id}`);
  }

  const updated: Seed = {
    ...existing,
    ...changes,
    id: existing.id,
    version: existing.version + 1,
    createdAt: existing.createdAt,
    updatedAt: now(),
  };

  const parsed = seedSchema.parse(updated);
  await db.seeds.put(parsed);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const existing = await db.seeds.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`Seed not found: ${id}`);
  }

  const timestamp = now();
  const deleted = seedSchema.parse({
    ...existing,
    deletedAt: timestamp,
    updatedAt: timestamp,
    version: existing.version + 1,
  });
  await db.seeds.put(deleted);
}

export async function getById(id: string): Promise<Seed | undefined> {
  const record = await db.seeds.get(id);
  if (!record || record.deletedAt != null) return undefined;
  return record;
}

export async function getAll(): Promise<Seed[]> {
  const records = await db.seeds.toArray();
  return records.filter((r) => r.deletedAt == null);
}

export async function getBySpecies(species: string): Promise<Seed[]> {
  const records = await db.seeds
    .where("species")
    .equals(species)
    .toArray();
  return records.filter((r) => r.deletedAt == null);
}

export async function getExpiringSoon(days: number): Promise<Seed[]> {
  const today = new Date();
  const cutoff = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
  const cutoffDate = cutoff.toISOString().split("T")[0]!;
  const todayDate = today.toISOString().split("T")[0]!;

  // Use the expiryDate index for an efficient range query.
  // Seeds without expiryDate are excluded since they're not in the index.
  const records = await db.seeds
    .where("expiryDate")
    .between(todayDate, cutoffDate, true, true)
    .toArray();

  return records.filter((r) => r.deletedAt == null);
}

/**
 * Deducts a quantity from a seed's remaining stock.
 * Runs in a transaction to prevent race conditions.
 * Throws if amount would make quantity negative.
 */
export async function deductQuantity(
  id: string,
  amount: number,
): Promise<Seed> {
  if (amount <= 0) {
    throw new Error("Deduction amount must be positive");
  }

  return await db.transaction("rw", db.seeds, async () => {
    const existing = await db.seeds.get(id);
    if (!existing || existing.deletedAt != null) {
      throw new Error(`Seed not found: ${id}`);
    }

    if (existing.quantityRemaining < amount) {
      throw new Error(
        `Insufficient quantity: ${String(existing.quantityRemaining)} remaining, tried to deduct ${String(amount)}`,
      );
    }

    const updated: Seed = {
      ...existing,
      quantityRemaining: existing.quantityRemaining - amount,
      version: existing.version + 1,
      updatedAt: now(),
    };

    const parsed = seedSchema.parse(updated);
    await db.seeds.put(parsed);
    return parsed;
  });
}
