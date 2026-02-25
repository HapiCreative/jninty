import { db } from "../schema.ts";
import {
  plantingSchema,
  type Planting,
} from "../../validation/planting.schema.ts";

type CreatePlantingInput = Omit<
  Planting,
  "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"
>;

type UpdatePlantingInput = Partial<CreatePlantingInput>;

function now(): string {
  return new Date().toISOString();
}

export async function create(input: CreatePlantingInput): Promise<Planting> {
  const timestamp = now();
  const record: Planting = {
    ...input,
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const parsed = plantingSchema.parse(record);
  await db.plantings.add(parsed);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdatePlantingInput,
): Promise<Planting> {
  const existing = await db.plantings.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`Planting not found: ${id}`);
  }

  const updated: Planting = {
    ...existing,
    ...changes,
    id: existing.id,
    version: existing.version + 1,
    createdAt: existing.createdAt,
    updatedAt: now(),
  };

  const parsed = plantingSchema.parse(updated);
  await db.plantings.put(parsed);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const existing = await db.plantings.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`Planting not found: ${id}`);
  }

  const timestamp = now();
  const deleted = plantingSchema.parse({
    ...existing,
    deletedAt: timestamp,
    updatedAt: timestamp,
    version: existing.version + 1,
  });
  await db.plantings.put(deleted);
}

export async function getById(id: string): Promise<Planting | undefined> {
  const record = await db.plantings.get(id);
  if (!record || record.deletedAt != null) return undefined;
  return record;
}

export async function getBySeason(seasonId: string): Promise<Planting[]> {
  const records = await db.plantings
    .where("seasonId")
    .equals(seasonId)
    .toArray();
  return records.filter((r) => r.deletedAt == null);
}

export async function getByPlant(
  plantInstanceId: string,
): Promise<Planting[]> {
  const records = await db.plantings
    .where("plantInstanceId")
    .equals(plantInstanceId)
    .toArray();
  return records.filter((r) => r.deletedAt == null);
}

export async function getByBed(bedId: string): Promise<Planting[]> {
  const records = await db.plantings
    .where("bedId")
    .equals(bedId)
    .toArray();
  return records.filter((r) => r.deletedAt == null);
}

export async function getAll(): Promise<Planting[]> {
  const records = await db.plantings.toArray();
  return records.filter((r) => r.deletedAt == null);
}
