import { db } from "../schema.ts";
import { seasonSchema, type Season } from "../../validation/season.schema.ts";

type CreateSeasonInput = Omit<
  Season,
  "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"
>;

type UpdateSeasonInput = Partial<CreateSeasonInput>;

function now(): string {
  return new Date().toISOString();
}

export async function create(input: CreateSeasonInput): Promise<Season> {
  const timestamp = now();
  const record: Season = {
    ...input,
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const parsed = seasonSchema.parse(record);
  await db.seasons.add(parsed);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdateSeasonInput,
): Promise<Season> {
  const existing = await db.seasons.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`Season not found: ${id}`);
  }

  const updated: Season = {
    ...existing,
    ...changes,
    id: existing.id,
    version: existing.version + 1,
    createdAt: existing.createdAt,
    updatedAt: now(),
  };

  const parsed = seasonSchema.parse(updated);
  await db.seasons.put(parsed);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const existing = await db.seasons.get(id);
  if (!existing || existing.deletedAt != null) {
    throw new Error(`Season not found: ${id}`);
  }

  const timestamp = now();
  const deleted = seasonSchema.parse({
    ...existing,
    deletedAt: timestamp,
    updatedAt: timestamp,
    version: existing.version + 1,
  });
  await db.seasons.put(deleted);
}

export async function getById(id: string): Promise<Season | undefined> {
  const record = await db.seasons.get(id);
  if (!record || record.deletedAt != null) return undefined;
  return record;
}

export async function getActive(): Promise<Season | undefined> {
  // Table scan — boolean indexes are unreliable in IndexedDB.
  // Fine for seasons (typically <10 records).
  const records = await db.seasons.toArray();
  return records.find((r) => r.isActive && r.deletedAt == null);
}

export async function getAll(): Promise<Season[]> {
  const records = await db.seasons.orderBy("year").reverse().toArray();
  return records.filter((r) => r.deletedAt == null);
}

/**
 * Sets a season as active, deactivating all others.
 * Runs in a transaction to ensure only one season is active at a time.
 */
export async function setActive(id: string): Promise<Season> {
  return await db.transaction("rw", db.seasons, async () => {
    const target = await db.seasons.get(id);
    if (!target || target.deletedAt != null) {
      throw new Error(`Season not found: ${id}`);
    }

    const timestamp = now();

    // Deactivate all other seasons
    const allSeasons = await db.seasons.toArray();
    for (const season of allSeasons) {
      if (season.isActive && season.id !== id && season.deletedAt == null) {
        await db.seasons.put(
          seasonSchema.parse({
            ...season,
            isActive: false,
            version: season.version + 1,
            updatedAt: timestamp,
          }),
        );
      }
    }

    // Activate the target
    const activated = seasonSchema.parse({
      ...target,
      isActive: true,
      version: target.version + 1,
      updatedAt: timestamp,
    });
    await db.seasons.put(activated);
    return activated;
  });
}
