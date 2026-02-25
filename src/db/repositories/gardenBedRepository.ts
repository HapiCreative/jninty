import { db } from "../schema.ts";
import {
  gardenBedSchema,
  type GardenBed,
  type BedType,
} from "../../validation/gardenBed.schema.ts";

type CreateGardenBedInput = Omit<
  GardenBed,
  "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"
>;

type UpdateGardenBedInput = Partial<CreateGardenBedInput>;

function now(): string {
  return new Date().toISOString();
}

export async function create(
  input: CreateGardenBedInput,
): Promise<GardenBed> {
  const timestamp = now();
  const record: GardenBed = {
    ...input,
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const parsed = gardenBedSchema.parse(record);
  await db.gardenBeds.add(parsed);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdateGardenBedInput,
): Promise<GardenBed> {
  const existing = await db.gardenBeds.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`GardenBed not found: ${id}`);
  }

  const updated: GardenBed = {
    ...existing,
    ...changes,
    id: existing.id,
    version: existing.version + 1,
    createdAt: existing.createdAt,
    updatedAt: now(),
  };

  const parsed = gardenBedSchema.parse(updated);
  await db.gardenBeds.put(parsed);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const existing = await db.gardenBeds.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`GardenBed not found: ${id}`);
  }

  const timestamp = now();
  const deleted = gardenBedSchema.parse({
    ...existing,
    deletedAt: timestamp,
    updatedAt: timestamp,
    version: existing.version + 1,
  });
  await db.gardenBeds.put(deleted);
}

export async function getById(
  id: string,
): Promise<GardenBed | undefined> {
  const record = await db.gardenBeds.get(id);
  if (!record || record.deletedAt != null) return undefined;
  return record;
}

export async function getAll(): Promise<GardenBed[]> {
  const records = await db.gardenBeds.toArray();
  return records.filter((r) => r.deletedAt == null);
}

export async function getByType(type: BedType): Promise<GardenBed[]> {
  const records = await db.gardenBeds.toArray();
  return records.filter((r) => r.deletedAt == null && r.type === type);
}
