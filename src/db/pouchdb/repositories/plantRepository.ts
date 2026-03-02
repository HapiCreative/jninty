import { localDB } from "../client.ts";
import { type PouchDoc, stripPouchFields, toPouchDoc } from "../utils.ts";
import {
  plantInstanceSchema,
  type PlantInstance,
  type PlantType,
  type PlantStatus,
} from "../../../validation/plantInstance.schema.ts";
import { ensureAllIndexes } from "../indexes.ts";

const DOC_TYPE = "plant";

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
  const doc = toPouchDoc(parsed, DOC_TYPE);
  await localDB.put(doc);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdatePlantInput,
): Promise<PlantInstance> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<PlantInstance>;
  try {
    existing = await localDB.get<PouchDoc<PlantInstance>>(docId);
  } catch {
    throw new Error(`PlantInstance not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`PlantInstance not found: ${id}`);
  }

  const updated: PlantInstance = {
    ...entity,
    ...changes,
    id: entity.id,
    version: entity.version + 1,
    createdAt: entity.createdAt,
    updatedAt: now(),
  };

  const parsed = plantInstanceSchema.parse(updated);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  doc._rev = existing._rev;
  await localDB.put(doc);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<PlantInstance>;
  try {
    existing = await localDB.get<PouchDoc<PlantInstance>>(docId);
  } catch {
    throw new Error(`PlantInstance not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`PlantInstance not found: ${id}`);
  }

  const timestamp = now();
  const deleted = plantInstanceSchema.parse({
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
): Promise<PlantInstance | undefined> {
  const docId = `${DOC_TYPE}:${id}`;
  try {
    const doc = await localDB.get<PouchDoc<PlantInstance>>(docId);
    const entity = stripPouchFields(doc);
    if (entity.deletedAt != null) return undefined;
    return entity;
  } catch {
    return undefined;
  }
}

export async function getAll(): Promise<PlantInstance[]> {
  await ensureAllIndexes();
  const result = await localDB.find({
    selector: {
      docType: DOC_TYPE,
    },
  });
  return (result.docs as PouchDoc<PlantInstance>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}

export async function getByStatus(
  status: PlantStatus,
): Promise<PlantInstance[]> {
  await ensureAllIndexes();
  const result = await localDB.find({
    selector: {
      docType: DOC_TYPE,
      status,
    },
  });
  return (result.docs as PouchDoc<PlantInstance>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}

export async function getByType(type: PlantType): Promise<PlantInstance[]> {
  await ensureAllIndexes();
  const result = await localDB.find({
    selector: {
      docType: DOC_TYPE,
      type,
    },
  });
  return (result.docs as PouchDoc<PlantInstance>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}
