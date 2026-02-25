import { db } from "../schema.ts";
import {
  plantInstanceSchema,
  type PlantInstance,
  type PlantType,
  type PlantStatus,
} from "../../validation/plantInstance.schema.ts";

type CreatePlantInput = Omit<
  PlantInstance,
  "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"
>;

type UpdatePlantInput = Partial<CreatePlantInput>;

function now(): string {
  return new Date().toISOString();
}

export async function create(input: CreatePlantInput): Promise<PlantInstance> {
  const timestamp = now();
  const record: PlantInstance = {
    ...input,
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const parsed = plantInstanceSchema.parse(record);
  await db.plantInstances.add(parsed);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdatePlantInput,
): Promise<PlantInstance> {
  const existing = await db.plantInstances.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`PlantInstance not found: ${id}`);
  }

  const updated: PlantInstance = {
    ...existing,
    ...changes,
    id: existing.id,
    version: existing.version + 1,
    createdAt: existing.createdAt,
    updatedAt: now(),
  };

  const parsed = plantInstanceSchema.parse(updated);
  await db.plantInstances.put(parsed);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const existing = await db.plantInstances.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`PlantInstance not found: ${id}`);
  }

  const timestamp = now();
  const deleted = plantInstanceSchema.parse({
    ...existing,
    deletedAt: timestamp,
    updatedAt: timestamp,
    version: existing.version + 1,
  });
  await db.plantInstances.put(deleted);
}

export async function getById(
  id: string,
): Promise<PlantInstance | undefined> {
  const record = await db.plantInstances.get(id);
  if (!record || record.deletedAt != null) return undefined;
  return record;
}

export async function getAll(): Promise<PlantInstance[]> {
  const records = await db.plantInstances.toArray();
  return records.filter((r) => r.deletedAt == null);
}

export async function getByStatus(
  status: PlantStatus,
): Promise<PlantInstance[]> {
  const records = await db.plantInstances
    .where("status")
    .equals(status)
    .toArray();
  return records.filter((r) => r.deletedAt == null);
}

export async function getByType(type: PlantType): Promise<PlantInstance[]> {
  const records = await db.plantInstances
    .where("type")
    .equals(type)
    .toArray();
  return records.filter((r) => r.deletedAt == null);
}
