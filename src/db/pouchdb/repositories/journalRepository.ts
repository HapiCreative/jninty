import { localDB } from "../client.ts";
import { type PouchDoc, stripPouchFields, toPouchDoc } from "../utils.ts";
import {
  journalEntrySchema,
  type JournalEntry,
  type ActivityType,
} from "../../../validation/journalEntry.schema.ts";

const DOC_TYPE = "journal";

type CreateJournalInput = Omit<
  JournalEntry,
  "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"
>;

type UpdateJournalInput = Partial<CreateJournalInput>;

function now(): string {
  return new Date().toISOString();
}

async function ensureIndexes(): Promise<void> {
  await localDB.createIndex({
    index: { fields: ["docType", "plantInstanceId"] },
  });
  await localDB.createIndex({
    index: { fields: ["docType", "activityType"] },
  });
  await localDB.createIndex({
    index: { fields: ["docType", "createdAt"] },
  });
  await localDB.createIndex({
    index: { fields: ["docType", "seasonId"] },
  });
}

let indexesReady: Promise<void> | null = null;
function initIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = ensureIndexes();
  }
  return indexesReady;
}

export async function create(
  input: CreateJournalInput,
): Promise<JournalEntry> {
  const timestamp = now();
  const record: JournalEntry = {
    ...input,
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const parsed = journalEntrySchema.parse(record);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  await localDB.put(doc);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdateJournalInput,
): Promise<JournalEntry> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<JournalEntry>;
  try {
    existing = await localDB.get<PouchDoc<JournalEntry>>(docId);
  } catch {
    throw new Error(`JournalEntry not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`JournalEntry not found: ${id}`);
  }

  const updated: JournalEntry = {
    ...entity,
    ...changes,
    id: entity.id,
    version: entity.version + 1,
    createdAt: entity.createdAt,
    updatedAt: now(),
  };

  const parsed = journalEntrySchema.parse(updated);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  doc._rev = existing._rev;
  await localDB.put(doc);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<JournalEntry>;
  try {
    existing = await localDB.get<PouchDoc<JournalEntry>>(docId);
  } catch {
    throw new Error(`JournalEntry not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`JournalEntry not found: ${id}`);
  }

  const timestamp = now();
  const deleted = journalEntrySchema.parse({
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
): Promise<JournalEntry | undefined> {
  const docId = `${DOC_TYPE}:${id}`;
  try {
    const doc = await localDB.get<PouchDoc<JournalEntry>>(docId);
    const entity = stripPouchFields(doc);
    if (entity.deletedAt != null) return undefined;
    return entity;
  } catch {
    return undefined;
  }
}

export async function getByPlantId(
  plantInstanceId: string,
): Promise<JournalEntry[]> {
  await initIndexes();
  const result = await localDB.find({
    selector: {
      docType: DOC_TYPE,
      plantInstanceId,
    },
  });
  return (result.docs as PouchDoc<JournalEntry>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}

export async function getRecent(limit: number): Promise<JournalEntry[]> {
  const result = await localDB.find({
    selector: { docType: DOC_TYPE },
  });
  return (result.docs as PouchDoc<JournalEntry>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function getByActivityType(
  activityType: ActivityType,
): Promise<JournalEntry[]> {
  await initIndexes();
  const result = await localDB.find({
    selector: {
      docType: DOC_TYPE,
      activityType,
    },
  });
  return (result.docs as PouchDoc<JournalEntry>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}

export async function getAll(): Promise<JournalEntry[]> {
  const result = await localDB.find({
    selector: { docType: DOC_TYPE },
  });
  return (result.docs as PouchDoc<JournalEntry>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getByDateRange(
  start: string,
  end: string,
): Promise<JournalEntry[]> {
  await initIndexes();
  const result = await localDB.find({
    selector: {
      docType: DOC_TYPE,
      createdAt: { $gte: start, $lte: end },
    },
  });
  return (result.docs as PouchDoc<JournalEntry>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}

export async function getBySeasonId(
  seasonId: string,
): Promise<JournalEntry[]> {
  await initIndexes();
  const result = await localDB.find({
    selector: {
      docType: DOC_TYPE,
      seasonId,
    },
  });
  return (result.docs as PouchDoc<JournalEntry>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}
