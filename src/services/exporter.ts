import JSZip from "jszip";
import { saveAs } from "file-saver";
import { db } from "../db/schema.ts";
import { readFile, displayPath, originalPath } from "./opfsStorage.ts";
import { plantInstanceSchema } from "../validation/plantInstance.schema.ts";
import { journalEntrySchema } from "../validation/journalEntry.schema.ts";
import { taskSchema } from "../validation/task.schema.ts";
import { gardenBedSchema } from "../validation/gardenBed.schema.ts";
import { settingsSchema } from "../validation/settings.schema.ts";
import { seasonSchema } from "../validation/season.schema.ts";
import { plantingSchema } from "../validation/planting.schema.ts";
import { seedSchema } from "../validation/seed.schema.ts";
import { z } from "zod";

// ─── Constants ───

const EXPORT_VERSION = 1;
const SCHEMA_VERSION = 3;

// ─── Manifest schema ───

const manifestSchema = z
  .object({
    exportVersion: z.number().int().positive(),
    schemaVersion: z.number().int().positive(),
    exportedAt: z.string().datetime(),
    appVersion: z.string().min(1),
  })
  .strict();

export type ExportManifest = z.infer<typeof manifestSchema>;

// ─── Import result ───

export type ImportResult = {
  valid: boolean;
  errors: string[];
  counts: {
    plantInstances: number;
    journalEntries: number;
    tasks: number;
    gardenBeds: number;
    settings: number;
    photos: number;
    seasons: number;
    plantings: number;
    seeds: number;
  };
};

// ─── Photo schema for import (Blobs become files in ZIP) ───
// Photos in the ZIP are stored as separate image files, not in a JSON array.
// We validate that each photo JSON entry matches the photo schema minus blobs.

const photoImportSchema = z
  .object({
    id: z.string().uuid(),
    version: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    deletedAt: z.string().datetime().optional(),
    displayStoredInOpfs: z.boolean().optional(),
    originalStored: z.boolean(),
    caption: z.string().min(1).optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .strict();

// ─── Helpers ───

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }
  // Fallback for environments where Blob.arrayBuffer isn't available
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

// ─── Export ───

export async function exportAll(): Promise<Blob> {
  const zip = new JSZip();

  // Manifest
  const manifest: ExportManifest = {
    exportVersion: EXPORT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: __APP_VERSION__,
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // Data folder
  const dataFolder = zip.folder("data")!;
  const photosFolder = zip.folder("photos")!;

  // Query all non-deleted records from each table
  const [
    plantInstances,
    journalEntries,
    tasks,
    gardenBeds,
    photos,
    seasons,
    plantings,
    seeds,
  ] = await Promise.all([
    db.plantInstances
      .toArray()
      .then((rows) => rows.filter((r) => r.deletedAt == null)),
    db.journalEntries
      .toArray()
      .then((rows) => rows.filter((r) => r.deletedAt == null)),
    db.tasks
      .toArray()
      .then((rows) => rows.filter((r) => r.deletedAt == null)),
    db.gardenBeds
      .toArray()
      .then((rows) => rows.filter((r) => r.deletedAt == null)),
    db.photos
      .toArray()
      .then((rows) => rows.filter((r) => r.deletedAt == null)),
    db.seasons
      .toArray()
      .then((rows) => rows.filter((r) => r.deletedAt == null)),
    db.plantings
      .toArray()
      .then((rows) => rows.filter((r) => r.deletedAt == null)),
    db.seeds
      .toArray()
      .then((rows) => rows.filter((r) => r.deletedAt == null)),
  ]);

  // Settings (single record, id = "singleton") — strip Dexie wrapper `id`
  const settingsRecord = await db.settings.get("singleton");
  const settingsArray = settingsRecord
    ? [
        (() => {
          const { id: _, ...settings } = settingsRecord;
          return settings;
        })(),
      ]
    : [];

  dataFolder.file("plantInstances.json", JSON.stringify(plantInstances));
  dataFolder.file("journalEntries.json", JSON.stringify(journalEntries));
  dataFolder.file("tasks.json", JSON.stringify(tasks));
  dataFolder.file("gardenBeds.json", JSON.stringify(gardenBeds));
  dataFolder.file("seasons.json", JSON.stringify(seasons));
  dataFolder.file("plantings.json", JSON.stringify(plantings));
  dataFolder.file("seeds.json", JSON.stringify(seeds));
  dataFolder.file("settings.json", JSON.stringify(settingsArray));

  // Photos: store metadata JSON + blob files
  const photoMetadata = photos.map((p) => ({
    id: p.id,
    version: p.version,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    ...(p.deletedAt != null ? { deletedAt: p.deletedAt } : {}),
    ...(p.displayStoredInOpfs ? { displayStoredInOpfs: true } : {}),
    originalStored: p.originalStored,
    ...(p.caption != null ? { caption: p.caption } : {}),
    ...(p.width != null ? { width: p.width } : {}),
    ...(p.height != null ? { height: p.height } : {}),
  }));
  dataFolder.file("photos.json", JSON.stringify(photoMetadata));

  for (const photo of photos) {
    photosFolder.file(
      `${photo.id}-thumb.jpg`,
      await blobToArrayBuffer(photo.thumbnailBlob),
    );

    // Read display blob from OPFS or IndexedDB
    const displayBlob = photo.displayStoredInOpfs
      ? await readFile(displayPath(photo.id))
      : photo.displayBlob;
    if (displayBlob) {
      photosFolder.file(
        `${photo.id}-display.jpg`,
        await blobToArrayBuffer(displayBlob),
      );
    }

    // Export original if stored in OPFS
    if (photo.originalStored) {
      const originalBlob = await readFile(originalPath(photo.id));
      if (originalBlob) {
        photosFolder.file(
          `${photo.id}-original.jpg`,
          await blobToArrayBuffer(originalBlob),
        );
      }
    }
  }

  return await zip.generateAsync({ type: "blob" });
}

// ─── Import (validate only for Phase 1) ───

export async function importFromZip(file: File): Promise<ImportResult> {
  const errors: string[] = [];
  const counts: ImportResult["counts"] = {
    plantInstances: 0,
    journalEntries: 0,
    tasks: 0,
    gardenBeds: 0,
    settings: 0,
    photos: 0,
    seasons: 0,
    plantings: 0,
    seeds: 0,
  };

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return { valid: false, errors: ["Failed to read ZIP file"], counts };
  }

  // Read and validate manifest
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    return {
      valid: false,
      errors: ["Missing manifest.json in ZIP"],
      counts,
    };
  }

  let manifest: ExportManifest;
  try {
    const raw: unknown = JSON.parse(await manifestFile.async("string"));
    manifest = manifestSchema.parse(raw);
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? `Invalid manifest: ${err.issues.map((i) => i.message).join(", ")}`
        : "Invalid manifest.json";
    return { valid: false, errors: [msg], counts };
  }

  if (manifest.schemaVersion > SCHEMA_VERSION) {
    return {
      valid: false,
      errors: [
        `Unsupported schema version ${String(manifest.schemaVersion)} (max supported: ${String(SCHEMA_VERSION)})`,
      ],
      counts,
    };
  }

  // Validate each data file
  const tableValidations: Array<{
    filename: string;
    schema: z.ZodSchema;
    countKey: keyof ImportResult["counts"];
  }> = [
    {
      filename: "data/plantInstances.json",
      schema: plantInstanceSchema,
      countKey: "plantInstances",
    },
    {
      filename: "data/journalEntries.json",
      schema: journalEntrySchema,
      countKey: "journalEntries",
    },
    { filename: "data/tasks.json", schema: taskSchema, countKey: "tasks" },
    {
      filename: "data/gardenBeds.json",
      schema: gardenBedSchema,
      countKey: "gardenBeds",
    },
    {
      filename: "data/settings.json",
      schema: settingsSchema,
      countKey: "settings",
    },
    {
      filename: "data/photos.json",
      schema: photoImportSchema,
      countKey: "photos",
    },
    {
      filename: "data/seasons.json",
      schema: seasonSchema,
      countKey: "seasons",
    },
    {
      filename: "data/plantings.json",
      schema: plantingSchema,
      countKey: "plantings",
    },
    {
      filename: "data/seeds.json",
      schema: seedSchema,
      countKey: "seeds",
    },
  ];

  for (const { filename, schema, countKey } of tableValidations) {
    const dataFile = zip.file(filename);
    if (!dataFile) {
      // Missing data files are OK — just skip with 0 count
      continue;
    }

    let items: unknown[];
    try {
      const raw: unknown = JSON.parse(await dataFile.async("string"));
      if (!Array.isArray(raw)) {
        errors.push(`${filename}: expected an array`);
        continue;
      }
      items = raw;
    } catch {
      errors.push(`${filename}: invalid JSON`);
      continue;
    }

    let validCount = 0;
    for (let i = 0; i < items.length; i++) {
      const result = schema.safeParse(items[i]);
      if (result.success) {
        validCount++;
      } else {
        const issues = result.error.issues
          .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
          .join("; ");
        errors.push(`${filename}[${String(i)}]: ${issues}`);
      }
    }
    counts[countKey] = validCount;
  }

  return { valid: errors.length === 0, errors, counts };
}

// ─── Download trigger ───

export function triggerDownload(blob: Blob, filename: string): void {
  saveAs(blob, filename);
}
