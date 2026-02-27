import { localDB } from "../client.ts";
import { type PouchDoc, stripPouchFields, toPouchDoc } from "../utils.ts";
import {
  plantingSchema,
  type Planting,
} from "../../../validation/planting.schema.ts";

const DOC_TYPE = "planting";

type CreatePlantingInput = Omit<
  Planting,
  "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"
>;

type UpdatePlantingInput = Partial<CreatePlantingInput>;

function now(): string {
  return new Date().toISOString();
}

async function ensureIndexes(): Promise<void> {
  await localDB.createIndex({
    index: { fields: ["docType", "plantInstanceId"] },
  });
  await localDB.createIndex({ index: { fields: ["docType", "seasonId"] } });
  await localDB.createIndex({ index: { fields: ["docType", "bedId"] } });
}

let indexesReady: Promise<void> | null = null;
function initIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = ensureIndexes();
  }
  return indexesReady;
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
  const doc = toPouchDoc(parsed, DOC_TYPE);
  await localDB.put(doc);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdatePlantingInput,
): Promise<Planting> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<Planting>;
  try {
    existing = await localDB.get<PouchDoc<Planting>>(docId);
  } catch {
    throw new Error(`Planting not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`Planting not found: ${id}`);
  }

  const updated: Planting = {
    ...entity,
    ...changes,
    id: entity.id,
    version: entity.version + 1,
    createdAt: entity.createdAt,
    updatedAt: now(),
  };

  const parsed = plantingSchema.parse(updated);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  doc._rev = existing._rev;
  await localDB.put(doc);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<Planting>;
  try {
    existing = await localDB.get<PouchDoc<Planting>>(docId);
  } catch {
    throw new Error(`Planting not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`Planting not found: ${id}`);
  }

  const timestamp = now();
  const deleted = plantingSchema.parse({
    ...entity,
    deletedAt: timestamp,
    updatedAt: timestamp,
    version: entity.version + 1,
  });

  const doc = toPouchDoc(deleted, DOC_TYPE);
  doc._rev = existing._rev;
  await localDB.put(doc);
}

export async function getById(id: string): Promise<Planting | undefined> {
  const docId = `${DOC_TYPE}:${id}`;
  try {
    const doc = await localDB.get<PouchDoc<Planting>>(docId);
    const entity = stripPouchFields(doc);
    if (entity.deletedAt != null) return undefined;
    return entity;
  } catch {
    return undefined;
  }
}

export async function getBySeason(seasonId: string): Promise<Planting[]> {
  await initIndexes();
  const result = await localDB.find({
    selector: {
      docType: DOC_TYPE,
      seasonId,
    },
  });
  return (result.docs as PouchDoc<Planting>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}

export async function getByPlant(
  plantInstanceId: string,
): Promise<Planting[]> {
  await initIndexes();
  const result = await localDB.find({
    selector: {
      docType: DOC_TYPE,
      plantInstanceId,
    },
  });
  return (result.docs as PouchDoc<Planting>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}

export async function getByBed(bedId: string): Promise<Planting[]> {
  await initIndexes();
  const result = await localDB.find({
    selector: {
      docType: DOC_TYPE,
      bedId,
    },
  });
  return (result.docs as PouchDoc<Planting>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}

export async function getAll(): Promise<Planting[]> {
  const result = await localDB.find({
    selector: { docType: DOC_TYPE },
  });
  return (result.docs as PouchDoc<Planting>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}
