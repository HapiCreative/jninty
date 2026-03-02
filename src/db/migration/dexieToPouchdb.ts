/**
 * One-time migration from Dexie (IndexedDB) to PouchDB.
 *
 * Reads every record from the Dexie database, converts them into PouchDB
 * documents with proper _id prefixes and docType fields, and bulk-inserts
 * them. Photos get their blobs (including OPFS-stored display/original
 * files) converted into PouchDB attachments for automatic CouchDB sync.
 *
 * The migration is idempotent — a marker document prevents re-runs.
 */

import { db } from "../schema.ts";
import { localDB } from "../pouchdb/client.ts";
import type { PouchDoc } from "../pouchdb/utils.ts";
import type { Photo } from "../../validation/photo.schema.ts";
import {
  isOpfsAvailable,
  readFile,
  displayPath,
  originalPath,
} from "../../services/opfsStorage.ts";

// ─── Types ───

export interface MigrationCounts {
  plantInstances: number;
  journalEntries: number;
  photos: number;
  tasks: number;
  gardenBeds: number;
  settings: number;
  seasons: number;
  plantings: number;
  seeds: number;
  taskRules: number;
  expenses: number;
}

export interface MigrationResult {
  migrated: boolean;
  counts: MigrationCounts;
  errors: string[];
}

export type MigrationProgress = {
  table: string;
  current: number;
  total: number;
};

const MIGRATION_MARKER_ID = "migration:dexie-complete";

// ─── Mapping: Dexie table name → PouchDB docType ───

const TABLE_DOC_TYPE_MAP: Record<string, string> = {
  plantInstances: "plant",
  journalEntries: "journal",
  photos: "photo",
  tasks: "task",
  gardenBeds: "gardenBed",
  settings: "settings",
  seasons: "season",
  plantings: "planting",
  seeds: "seed",
  taskRules: "taskRule",
  expenses: "expense",
};

// Tables that are caches and don't need migration
const SKIP_TABLES = new Set(["searchIndex", "weatherCache"]);

// ─── Helpers ───

/**
 * Convert a Blob to a format PouchDB can store as an attachment.
 * In the browser PouchDB accepts Blob directly.
 * In Node.js / jsdom (tests) PouchDB needs a Buffer.
 */
async function toAttachmentData(blob: Blob | Buffer): Promise<Blob | Buffer> {
  if (typeof Buffer !== "undefined" && blob instanceof Buffer) {
    return blob;
  }
  if (typeof Buffer !== "undefined") {
    if (typeof (blob as Blob).arrayBuffer === "function") {
      return Buffer.from(await (blob as Blob).arrayBuffer());
    }
    const text = await (blob as Blob).text();
    return Buffer.from(text);
  }
  return blob;
}

// ─── Migration check ───

export async function isMigrationComplete(): Promise<boolean> {
  try {
    await localDB.get(MIGRATION_MARKER_ID);
    return true;
  } catch {
    return false;
  }
}

export async function dexieHasData(): Promise<boolean> {
  try {
    // Check if any of the main tables have records
    const plantCount = await db.plantInstances.count();
    const journalCount = await db.journalEntries.count();
    const taskCount = await db.tasks.count();
    const photoCount = await db.photos.count();
    const bedCount = await db.gardenBeds.count();
    const settingsCount = await db.settings.count();

    return (
      plantCount + journalCount + taskCount + photoCount + bedCount + settingsCount > 0
    );
  } catch {
    // Dexie DB doesn't exist or can't be opened
    return false;
  }
}

// ─── Core migration ───

/**
 * Migrate a single non-photo entity table from Dexie to PouchDB.
 */
async function migrateTable(
  tableName: string,
  docType: string,
  onProgress?: (progress: MigrationProgress) => void,
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  const table = db.table(tableName);
  const records = await table.toArray();
  const total = records.length;

  if (total === 0) {
    onProgress?.({ table: tableName, current: 0, total: 0 });
    return { count: 0, errors };
  }

  const docs: PouchDoc<Record<string, unknown>>[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i] as Record<string, unknown>;
    try {
      const id = record["id"] as string;
      const _id =
        tableName === "settings"
          ? `${docType}:singleton`
          : `${docType}:${id}`;

      docs.push({
        ...record,
        _id,
        docType,
      } as PouchDoc<Record<string, unknown>>);
    } catch (err) {
      errors.push(
        `${tableName}: failed to convert record ${String(record["id"])}: ${String(err)}`,
      );
    }

    onProgress?.({ table: tableName, current: i + 1, total });
  }

  if (docs.length > 0) {
    const results = await localDB.bulkDocs(docs);
    for (const result of results) {
      if ("error" in result && result.error) {
        errors.push(
          `${tableName}: bulkDocs error for ${result.id ?? "unknown"}: ${
            "message" in result ? String(result.message) : "unknown error"
          }`,
        );
      }
    }
  }

  return { count: docs.length, errors };
}

/**
 * Migrate photos with their blobs as PouchDB attachments.
 * Reads thumbnailBlob from IndexedDB, displayBlob from IndexedDB or OPFS,
 * and original from OPFS.
 */
async function migratePhotos(
  onProgress?: (progress: MigrationProgress) => void,
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  const photos = await db.photos.toArray();
  const total = photos.length;

  if (total === 0) {
    onProgress?.({ table: "photos", current: 0, total: 0 });
    return { count: 0, errors };
  }

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i] as Photo;
    try {
      const _id = `photo:${photo.id}`;

      // Build attachments from blobs
      const attachments: Record<
        string,
        { content_type: string; data: Blob | Buffer }
      > = {};

      // Thumbnail is always in IndexedDB
      if (photo.thumbnailBlob) {
        attachments["thumbnail"] = {
          content_type:
            (photo.thumbnailBlob as Blob).type || "image/jpeg",
          data: await toAttachmentData(photo.thumbnailBlob),
        };
      }

      // Display blob: either in IndexedDB or OPFS
      if (photo.displayBlob) {
        attachments["display"] = {
          content_type:
            (photo.displayBlob as Blob).type || "image/jpeg",
          data: await toAttachmentData(photo.displayBlob),
        };
      } else if (photo.displayStoredInOpfs && isOpfsAvailable()) {
        const opfsBlob = await readFile(displayPath(photo.id));
        if (opfsBlob) {
          attachments["display"] = {
            content_type: opfsBlob.type || "image/jpeg",
            data: await toAttachmentData(opfsBlob),
          };
        }
      }

      // Original: always in OPFS
      if (photo.originalStored && isOpfsAvailable()) {
        const opfsBlob = await readFile(originalPath(photo.id));
        if (opfsBlob) {
          attachments["original"] = {
            content_type: opfsBlob.type || "image/jpeg",
            data: await toAttachmentData(opfsBlob),
          };
        }
      }

      // Strip blob fields from the document body
      const {
        thumbnailBlob: _tb,
        displayBlob: _db,
        ...docFields
      } = photo as Record<string, unknown>;
      void _tb;
      void _db;

      const pouchDoc: Record<string, unknown> = {
        ...docFields,
        _id,
        docType: "photo",
        // PouchDB stores blobs in OPFS → we no longer need these flags
        displayStoredInOpfs: false,
        originalStored: Object.hasOwn(attachments, "original"),
      };

      if (Object.keys(attachments).length > 0) {
        pouchDoc["_attachments"] = attachments;
      }

      await localDB.put(pouchDoc);
    } catch (err) {
      errors.push(`photos: failed to migrate ${photo.id}: ${String(err)}`);
    }

    onProgress?.({ table: "photos", current: i + 1, total });
  }

  return { count: photos.length, errors };
}

/**
 * Run the full Dexie → PouchDB migration.
 *
 * Idempotent: if the migration marker already exists, returns immediately.
 */
export async function migrateAll(
  onProgress?: (progress: MigrationProgress) => void,
): Promise<MigrationResult> {
  // Check if already migrated
  if (await isMigrationComplete()) {
    return {
      migrated: false,
      counts: emptyCounts(),
      errors: [],
    };
  }

  const allErrors: string[] = [];
  const counts: MigrationCounts = emptyCounts();

  // Migrate each non-photo table
  for (const [tableName, docType] of Object.entries(TABLE_DOC_TYPE_MAP)) {
    if (tableName === "photos") continue; // handled separately
    if (SKIP_TABLES.has(tableName)) continue;

    const { count, errors } = await migrateTable(tableName, docType, onProgress);
    counts[tableName as keyof MigrationCounts] = count;
    allErrors.push(...errors);
  }

  // Migrate photos with attachments
  const { count: photoCount, errors: photoErrors } =
    await migratePhotos(onProgress);
  counts.photos = photoCount;
  allErrors.push(...photoErrors);

  // Store migration completion marker
  await localDB.put({
    _id: MIGRATION_MARKER_ID,
    completedAt: new Date().toISOString(),
    counts,
  });

  return {
    migrated: true,
    counts,
    errors: allErrors,
  };
}

// ─── Verification ───

/**
 * Compare record counts between Dexie and PouchDB.
 * Returns true if all counts match.
 */
export async function verifyMigration(): Promise<boolean> {
  for (const [tableName, docType] of Object.entries(TABLE_DOC_TYPE_MAP)) {
    if (SKIP_TABLES.has(tableName)) continue;

    const dexieCount = await db.table(tableName).count();

    // Count PouchDB docs for this docType
    let pouchCount: number;
    if (tableName === "settings") {
      // Settings is a singleton — either 0 or 1
      try {
        await localDB.get(`${docType}:singleton`);
        pouchCount = 1;
      } catch {
        pouchCount = 0;
      }
    } else if (tableName === "photos") {
      // Photos don't have a find index, use allDocs range query
      const result = await localDB.allDocs({
        startkey: `${docType}:`,
        endkey: `${docType}:\ufff0`,
      });
      pouchCount = result.rows.length;
    } else {
      const result = await localDB.allDocs({
        startkey: `${docType}:`,
        endkey: `${docType}:\ufff0`,
      });
      pouchCount = result.rows.length;
    }

    if (dexieCount !== pouchCount) {
      return false;
    }
  }

  return true;
}

// ─── Cleanup ───

/**
 * Delete the Dexie database to free up IndexedDB space.
 * Only call after verifyMigration() returns true and user confirms.
 */
export async function cleanupDexie(): Promise<void> {
  await db.delete();
}

// ─── Utilities ───

function emptyCounts(): MigrationCounts {
  return {
    plantInstances: 0,
    journalEntries: 0,
    photos: 0,
    tasks: 0,
    gardenBeds: 0,
    settings: 0,
    seasons: 0,
    plantings: 0,
    seeds: 0,
    taskRules: 0,
    expenses: 0,
  };
}
