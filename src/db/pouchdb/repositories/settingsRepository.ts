import { localDB } from "../client.ts";
import {
  settingsSchema,
  type Settings,
} from "../../../validation/settings.schema.ts";

const DOC_TYPE = "settings";
const DOC_ID = `${DOC_TYPE}:singleton`;

export async function get(): Promise<Settings | undefined> {
  try {
    const doc = await localDB.get<Record<string, unknown>>(DOC_ID);
    // Strip PouchDB and wrapper fields
    const { _id, _rev, docType, ...rest } = doc;
    void _id;
    void _rev;
    void docType;
    return rest as unknown as Settings;
  } catch {
    return undefined;
  }
}

export async function update(
  changes: Partial<Settings>,
): Promise<Settings> {
  let existing: Record<string, unknown> | undefined;
  let rev: string | undefined;

  try {
    const doc = await localDB.get<Record<string, unknown>>(DOC_ID);
    rev = doc._rev;
    const { _id, _rev: _, docType, ...rest } = doc;
    void _id;
    void _;
    void docType;
    existing = rest;
  } catch {
    // Document doesn't exist yet
  }

  let merged: Settings;
  if (existing) {
    merged = { ...(existing as Settings), ...changes };
  } else {
    merged = settingsSchema.parse(changes);
  }

  const parsed = settingsSchema.parse(merged);

  const pouchDoc: Record<string, unknown> = {
    _id: DOC_ID,
    docType: DOC_TYPE,
    ...parsed,
  };

  if (rev) {
    pouchDoc["_rev"] = rev;
  }

  await localDB.put(pouchDoc);
  return parsed;
}

export async function clearLocation(): Promise<Settings> {
  let doc: Record<string, unknown>;
  try {
    doc = await localDB.get<Record<string, unknown>>(DOC_ID);
  } catch {
    throw new Error("Settings not initialized");
  }

  const { _id, _rev, docType, ...rest } = doc;
  void _id;
  void docType;

  const settings = rest as Record<string, unknown>;
  delete settings["latitude"];
  delete settings["longitude"];

  const parsed = settingsSchema.parse(settings);

  const pouchDoc: Record<string, unknown> = {
    _id: DOC_ID,
    _rev,
    docType: DOC_TYPE,
    ...parsed,
  };

  await localDB.put(pouchDoc);
  return parsed;
}
