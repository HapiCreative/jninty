import { localDB } from "../client.ts";
import { type PouchDoc, stripPouchFields, toPouchDoc } from "../utils.ts";
import {
  userPlantKnowledgeSchema,
  type UserPlantKnowledge,
} from "../../../validation/userPlantKnowledge.schema.ts";
import { ensureAllIndexes } from "../indexes.ts";

const DOC_TYPE = "userPlantKnowledge";

type CreateInput = Omit<
  UserPlantKnowledge,
  "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"
>;

type UpdateInput = Partial<CreateInput>;

/**
 * Optional plant knowledge fields that can be cleared on update.
 * When a full replacement is intended, these are stripped from the existing
 * entity before merging changes so that cleared fields don't persist.
 */
const OPTIONAL_DATA_KEYS: readonly string[] = [
  "variety",
  "soilPreference",
  "growthRate",
  "spacingInches",
  "matureHeightInches",
  "matureSpreadInches",
  "indoorStartWeeksBeforeLastFrost",
  "transplantWeeksAfterLastFrost",
  "directSowWeeksBeforeLastFrost",
  "directSowWeeksAfterLastFrost",
  "daysToGermination",
  "daysToMaturity",
  "goodCompanions",
  "badCompanions",
  "commonPests",
  "commonDiseases",
];

function now(): string {
  return new Date().toISOString();
}

export async function create(input: CreateInput): Promise<UserPlantKnowledge> {
  const timestamp = now();
  const record: UserPlantKnowledge = {
    ...input,
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const parsed = userPlantKnowledgeSchema.parse(record);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  await localDB.put(doc);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdateInput,
  options?: { replaceAll?: boolean },
): Promise<UserPlantKnowledge> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<UserPlantKnowledge>;
  try {
    existing = await localDB.get<PouchDoc<UserPlantKnowledge>>(docId);
  } catch {
    throw new Error(`UserPlantKnowledge not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`UserPlantKnowledge not found: ${id}`);
  }

  // When replaceAll is true, strip optional data fields from the existing
  // entity before merging so that cleared fields don't persist.
  let base: UserPlantKnowledge = entity;
  if (options?.replaceAll) {
    const stripped = { ...entity };
    for (const key of OPTIONAL_DATA_KEYS) {
      delete (stripped as Record<string, unknown>)[key];
    }
    base = stripped as UserPlantKnowledge;
  }

  const updated: UserPlantKnowledge = {
    ...base,
    ...changes,
    id: entity.id,
    version: entity.version + 1,
    createdAt: entity.createdAt,
    updatedAt: now(),
  };

  const parsed = userPlantKnowledgeSchema.parse(updated);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  doc._rev = existing._rev;
  await localDB.put(doc);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<UserPlantKnowledge>;
  try {
    existing = await localDB.get<PouchDoc<UserPlantKnowledge>>(docId);
  } catch {
    throw new Error(`UserPlantKnowledge not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`UserPlantKnowledge not found: ${id}`);
  }

  const timestamp = now();
  const deleted = userPlantKnowledgeSchema.parse({
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
): Promise<UserPlantKnowledge | undefined> {
  const docId = `${DOC_TYPE}:${id}`;
  try {
    const doc = await localDB.get<PouchDoc<UserPlantKnowledge>>(docId);
    const entity = stripPouchFields(doc);
    if (entity.deletedAt != null) return undefined;
    return entity;
  } catch {
    return undefined;
  }
}

export async function getAll(): Promise<UserPlantKnowledge[]> {
  await ensureAllIndexes();
  const result = await localDB.find({
    selector: {
      docType: DOC_TYPE,
    },
  });
  return (result.docs as PouchDoc<UserPlantKnowledge>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}
