import { db, type SettingsRecord } from "../schema.ts";
import {
  settingsSchema,
  type Settings,
} from "../../validation/settings.schema.ts";

const SETTINGS_ID = "singleton";

function stripId(record: SettingsRecord): Settings {
  const copy = { ...record };
  delete (copy as Partial<SettingsRecord>).id;
  return copy as unknown as Settings;
}

export async function get(): Promise<Settings | undefined> {
  const record = await db.settings.get(SETTINGS_ID);
  if (!record) return undefined;
  return stripId(record);
}

export async function update(
  changes: Partial<Settings>,
): Promise<Settings> {
  const existing = await db.settings.get(SETTINGS_ID);

  let merged: Settings;
  if (existing) {
    merged = { ...stripId(existing), ...changes };
  } else {
    // First write must include all required fields.
    merged = settingsSchema.parse(changes);
  }

  const parsed = settingsSchema.parse(merged);
  const record: SettingsRecord = { id: SETTINGS_ID, ...parsed };
  await db.settings.put(record);
  return parsed;
}

/**
 * Remove location fields (latitude/longitude) from settings.
 * Needed because `update()` uses merge semantics and cannot delete fields.
 */
export async function clearLocation(): Promise<Settings> {
  const existing = await db.settings.get(SETTINGS_ID);
  if (!existing) throw new Error("Settings not initialized");

  const settings = stripId(existing) as Record<string, unknown>;
  delete settings["latitude"];
  delete settings["longitude"];

  const parsed = settingsSchema.parse(settings);
  const record: SettingsRecord = { id: SETTINGS_ID, ...parsed };
  await db.settings.put(record);
  return parsed;
}
