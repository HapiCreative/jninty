import { localDB } from "../client.ts";
import { type PouchDoc, stripPouchFields, toPouchDoc } from "../utils.ts";
import {
  gardenBedSchema,
  type GardenBed,
  type BedType,
} from "../../../validation/gardenBed.schema.ts";
import { ensureAllIndexes } from "../indexes.ts";

const DOC_TYPE = "gardenBed";

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
  const doc = toPouchDoc(parsed, DOC_TYPE);
  await localDB.put(doc);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdateGardenBedInput,
): Promise<GardenBed> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<GardenBed>;
  try {
    existing = await localDB.get<PouchDoc<GardenBed>>(docId);
  } catch {
    throw new Error(`GardenBed not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`GardenBed not found: ${id}`);
  }

  const updated: GardenBed = {
    ...entity,
    ...changes,
    id: entity.id,
    version: entity.version + 1,
    createdAt: entity.createdAt,
    updatedAt: now(),
  };

  const parsed = gardenBedSchema.parse(updated);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  doc._rev = existing._rev;
  await localDB.put(doc);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<GardenBed>;
  try {
    existing = await localDB.get<PouchDoc<GardenBed>>(docId);
  } catch {
    throw new Error(`GardenBed not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`GardenBed not found: ${id}`);
  }

  const timestamp = now();
  const deleted = gardenBedSchema.parse({
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
): Promise<GardenBed | undefined> {
  const docId = `${DOC_TYPE}:${id}`;
  try {
    const doc = await localDB.get<PouchDoc<GardenBed>>(docId);
    const entity = stripPouchFields(doc);
    if (entity.deletedAt != null) return undefined;
    return entity;
  } catch {
    return undefined;
  }
}

export async function getAll(): Promise<GardenBed[]> {
  await ensureAllIndexes();
  const result = await localDB.find({
    selector: { docType: DOC_TYPE },
  });
  return (result.docs as PouchDoc<GardenBed>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}

export async function getByType(type: BedType): Promise<GardenBed[]> {
  await ensureAllIndexes();
  const result = await localDB.find({
    selector: { docType: DOC_TYPE },
  });
  return (result.docs as PouchDoc<GardenBed>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null && r.type === type);
}
