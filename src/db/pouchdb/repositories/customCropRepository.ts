import { localDB } from "../client.ts";
import { type PouchDoc, stripPouchFields, toPouchDoc } from "../utils.ts";
import {
  customCropSchema,
  type CustomCrop,
} from "../../../validation/customCrop.schema.ts";
import { ensureAllIndexes } from "../indexes.ts";

const DOC_TYPE = "customCrop";

type CreateInput = Omit<
  CustomCrop,
  "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"
>;

type UpdateInput = Partial<CreateInput>;

function now(): string {
  return new Date().toISOString();
}

export async function create(input: CreateInput): Promise<CustomCrop> {
  const timestamp = now();
  const record: CustomCrop = {
    ...input,
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const parsed = customCropSchema.parse(record);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  await localDB.put(doc);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdateInput,
): Promise<CustomCrop> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<CustomCrop>;
  try {
    existing = await localDB.get<PouchDoc<CustomCrop>>(docId);
  } catch {
    throw new Error(`CustomCrop not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`CustomCrop not found: ${id}`);
  }

  const updated: CustomCrop = {
    ...entity,
    ...changes,
    id: entity.id,
    version: entity.version + 1,
    createdAt: entity.createdAt,
    updatedAt: now(),
  };

  const parsed = customCropSchema.parse(updated);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  doc._rev = existing._rev;
  await localDB.put(doc);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<CustomCrop>;
  try {
    existing = await localDB.get<PouchDoc<CustomCrop>>(docId);
  } catch {
    throw new Error(`CustomCrop not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`CustomCrop not found: ${id}`);
  }

  const timestamp = now();
  const deleted = customCropSchema.parse({
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
): Promise<CustomCrop | undefined> {
  const docId = `${DOC_TYPE}:${id}`;
  try {
    const doc = await localDB.get<PouchDoc<CustomCrop>>(docId);
    const entity = stripPouchFields(doc);
    if (entity.deletedAt != null) return undefined;
    return entity;
  } catch {
    return undefined;
  }
}

export async function getAll(): Promise<CustomCrop[]> {
  await ensureAllIndexes();
  const result = await localDB.find({
    selector: { docType: DOC_TYPE },
  });
  return (result.docs as PouchDoc<CustomCrop>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}
