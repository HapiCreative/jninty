import { localDB } from "../client.ts";
import { type PouchDoc, stripPouchFields, toPouchDoc } from "../utils.ts";
import {
  plantingScheduleSchema,
  type PlantingSchedule,
} from "../../../validation/plantingSchedule.schema.ts";
import { ensureAllIndexes } from "../indexes.ts";

const DOC_TYPE = "plantingSchedule";

type CreateInput = Omit<
  PlantingSchedule,
  "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"
>;

type UpdateInput = Partial<CreateInput>;

function now(): string {
  return new Date().toISOString();
}

export async function create(input: CreateInput): Promise<PlantingSchedule> {
  const timestamp = now();
  const record: PlantingSchedule = {
    ...input,
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const parsed = plantingScheduleSchema.parse(record);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  await localDB.put(doc);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdateInput,
): Promise<PlantingSchedule> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<PlantingSchedule>;
  try {
    existing = await localDB.get<PouchDoc<PlantingSchedule>>(docId);
  } catch {
    throw new Error(`PlantingSchedule not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`PlantingSchedule not found: ${id}`);
  }

  const updated: PlantingSchedule = {
    ...entity,
    ...changes,
    id: entity.id,
    version: entity.version + 1,
    createdAt: entity.createdAt,
    updatedAt: now(),
  };

  const parsed = plantingScheduleSchema.parse(updated);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  doc._rev = existing._rev;
  await localDB.put(doc);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<PlantingSchedule>;
  try {
    existing = await localDB.get<PouchDoc<PlantingSchedule>>(docId);
  } catch {
    throw new Error(`PlantingSchedule not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`PlantingSchedule not found: ${id}`);
  }

  const timestamp = now();
  const deleted = plantingScheduleSchema.parse({
    ...entity,
    deletedAt: timestamp,
    updatedAt: timestamp,
    version: entity.version + 1,
  });

  const doc = toPouchDoc(deleted, DOC_TYPE);
  doc._rev = existing._rev;
  await localDB.put(doc);
}

export async function getById(
  id: string,
): Promise<PlantingSchedule | undefined> {
  const docId = `${DOC_TYPE}:${id}`;
  try {
    const doc = await localDB.get<PouchDoc<PlantingSchedule>>(docId);
    const entity = stripPouchFields(doc);
    if (entity.deletedAt != null) return undefined;
    return entity;
  } catch {
    return undefined;
  }
}

export async function getAll(): Promise<PlantingSchedule[]> {
  await ensureAllIndexes();
  const result = await localDB.find({
    selector: { docType: DOC_TYPE },
  });
  return (result.docs as PouchDoc<PlantingSchedule>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}

export async function getBySeasonId(
  seasonId: string,
): Promise<PlantingSchedule[]> {
  await ensureAllIndexes();
  const result = await localDB.find({
    selector: { docType: DOC_TYPE },
  });
  return (result.docs as PouchDoc<PlantingSchedule>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null && r.seasonId === seasonId);
}

export async function getByBedId(
  bedId: string,
): Promise<PlantingSchedule[]> {
  await ensureAllIndexes();
  const result = await localDB.find({
    selector: { docType: DOC_TYPE },
  });
  return (result.docs as PouchDoc<PlantingSchedule>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null && r.bedId === bedId);
}

export async function getByDateRange(
  start: string,
  end: string,
): Promise<PlantingSchedule[]> {
  await ensureAllIndexes();
  const result = await localDB.find({
    selector: { docType: DOC_TYPE },
  });
  return (result.docs as PouchDoc<PlantingSchedule>[])
    .map(stripPouchFields)
    .filter(
      (r) =>
        r.deletedAt == null &&
        r.harvestEndDate >= start &&
        (r.seedStartDate ?? r.harvestStartDate) <= end,
    );
}
