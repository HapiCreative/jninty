import { db } from "../schema.ts";
import {
  journalEntrySchema,
  type JournalEntry,
  type ActivityType,
} from "../../validation/journalEntry.schema.ts";

type CreateJournalInput = Omit<
  JournalEntry,
  "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"
>;

type UpdateJournalInput = Partial<CreateJournalInput>;

function now(): string {
  return new Date().toISOString();
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
  await db.journalEntries.add(parsed);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdateJournalInput,
): Promise<JournalEntry> {
  const existing = await db.journalEntries.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`JournalEntry not found: ${id}`);
  }

  const updated: JournalEntry = {
    ...existing,
    ...changes,
    id: existing.id,
    version: existing.version + 1,
    createdAt: existing.createdAt,
    updatedAt: now(),
  };

  const parsed = journalEntrySchema.parse(updated);
  await db.journalEntries.put(parsed);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const existing = await db.journalEntries.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`JournalEntry not found: ${id}`);
  }

  const timestamp = now();
  const deleted = journalEntrySchema.parse({
    ...existing,
    deletedAt: timestamp,
    updatedAt: timestamp,
    version: existing.version + 1,
  });
  await db.journalEntries.put(deleted);
}

export async function getById(
  id: string,
): Promise<JournalEntry | undefined> {
  const record = await db.journalEntries.get(id);
  if (!record || record.deletedAt != null) return undefined;
  return record;
}

export async function getByPlantId(
  plantInstanceId: string,
): Promise<JournalEntry[]> {
  const records = await db.journalEntries
    .where("plantInstanceId")
    .equals(plantInstanceId)
    .toArray();
  return records.filter((r) => r.deletedAt == null);
}

export async function getRecent(limit: number): Promise<JournalEntry[]> {
  const results: JournalEntry[] = [];
  await db.journalEntries
    .orderBy("createdAt")
    .reverse()
    .until(() => results.length >= limit)
    .each((record) => {
      if (record.deletedAt == null) {
        results.push(record);
      }
    });
  return results;
}

export async function getByActivityType(
  activityType: ActivityType,
): Promise<JournalEntry[]> {
  const records = await db.journalEntries
    .where("activityType")
    .equals(activityType)
    .toArray();
  return records.filter((r) => r.deletedAt == null);
}

export async function getAll(): Promise<JournalEntry[]> {
  const records = await db.journalEntries
    .orderBy("createdAt")
    .reverse()
    .toArray();
  return records.filter((r) => r.deletedAt == null);
}

export async function getByDateRange(
  start: string,
  end: string,
): Promise<JournalEntry[]> {
  const records = await db.journalEntries
    .where("createdAt")
    .between(start, end, true, true)
    .toArray();
  return records.filter((r) => r.deletedAt == null);
}

export async function getBySeasonId(
  seasonId: string,
): Promise<JournalEntry[]> {
  const records = await db.journalEntries
    .where("seasonId")
    .equals(seasonId)
    .toArray();
  return records.filter((r) => r.deletedAt == null);
}
