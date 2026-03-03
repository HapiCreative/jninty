import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  plantRepository,
  journalRepository,
  taskRepository,
  gardenBedRepository,
  settingsRepository,
  seasonRepository,
  plantingRepository,
  seedRepository,
  taskRuleRepository,
  userPlantKnowledgeRepository,
} from "../db/index.ts";
import { localDB } from "../db/pouchdb/client.ts";
import { stripPouchFields, type PouchDoc } from "../db/pouchdb/utils.ts";
import { getOriginal } from "../db/pouchdb/originalsStore.ts";
import { plantInstanceSchema } from "../validation/plantInstance.schema.ts";
import { journalEntrySchema } from "../validation/journalEntry.schema.ts";
import { taskSchema } from "../validation/task.schema.ts";
import { gardenBedSchema } from "../validation/gardenBed.schema.ts";
import { settingsSchema } from "../validation/settings.schema.ts";
import { seasonSchema } from "../validation/season.schema.ts";
import { plantingSchema } from "../validation/planting.schema.ts";
import { seedSchema } from "../validation/seed.schema.ts";
import { taskRuleSchema } from "../validation/taskRule.schema.ts";
import { userPlantKnowledgeSchema } from "../validation/userPlantKnowledge.schema.ts";
import { z } from "zod";

// ─── Constants ───

const EXPORT_VERSION = 1;
export const SCHEMA_VERSION = 5;

// ─── Manifest schema ───

export const manifestSchema = z
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
    taskRules: number;
    userPlantKnowledge: number;
  };
};

// ─── Photo schema for import (Blobs become files in ZIP) ───
// Photos in the ZIP are stored as separate image files, not in a JSON array.
// We validate that each photo JSON entry matches the photo schema minus blobs.

export const photoImportSchema = z
  .object({
    id: z.string().uuid(),
    version: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    deletedAt: z.string().datetime().optional(),
    originalStored: z.boolean(),
    caption: z.string().min(1).optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .strict();

// ─── Photo metadata type for PouchDB docs ───

type PhotoMetaDoc = {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  originalStored: boolean;
  caption?: string;
  width?: number;
  height?: number;
  thumbnailBlob?: unknown;
  displayBlob?: unknown;
  displayStoredInOpfs?: boolean;
};

// ─── Helpers ───

async function blobToArrayBuffer(
  blob: Blob | Buffer,
): Promise<Uint8Array> {
  if (typeof Buffer !== "undefined" && blob instanceof Buffer) {
    // Copy into a clean Uint8Array so JSZip can handle it
    return new Uint8Array(blob);
  }
  if (blob instanceof Blob && typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }
  // Fallback for environments where Blob.arrayBuffer isn't available
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob as Blob);
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

  // Query all non-deleted records from each table via PouchDB repositories
  const [
    plantInstances,
    journalEntries,
    tasks,
    gardenBeds,
    seasons,
    plantings,
    seeds,
    allTaskRules,
    userPlantKnowledge,
  ] = await Promise.all([
    plantRepository.getAll(),
    journalRepository.getAll(),
    taskRepository.getAll(),
    gardenBedRepository.getAll(),
    seasonRepository.getAll(),
    plantingRepository.getAll(),
    seedRepository.getAll(),
    taskRuleRepository.getAll(),
    userPlantKnowledgeRepository.getAll(),
  ]);

  // Filter out built-in task rules
  const taskRules = allTaskRules.filter((r) => !r.isBuiltIn);

  // Settings (single record)
  const settingsRecord = await settingsRepository.get();
  const settingsArray = settingsRecord ? [settingsRecord] : [];

  // Photos: query from PouchDB directly using allDocs range query
  const photoResult = await localDB.allDocs({
    startkey: "photo:",
    endkey: "photo:\uffff",
    include_docs: true,
  });

  const photos = photoResult.rows
    .filter((row) => row.doc != null)
    .map((row) => {
      const doc = row.doc as PouchDoc<PhotoMetaDoc>;
      return stripPouchFields(doc);
    })
    .filter((p) => p.deletedAt == null);

  dataFolder.file("plantInstances.json", JSON.stringify(plantInstances));
  dataFolder.file("journalEntries.json", JSON.stringify(journalEntries));
  dataFolder.file("tasks.json", JSON.stringify(tasks));
  dataFolder.file("gardenBeds.json", JSON.stringify(gardenBeds));
  dataFolder.file("seasons.json", JSON.stringify(seasons));
  dataFolder.file("plantings.json", JSON.stringify(plantings));
  dataFolder.file("seeds.json", JSON.stringify(seeds));
  dataFolder.file("taskRules.json", JSON.stringify(taskRules));
  dataFolder.file("userPlantKnowledge.json", JSON.stringify(userPlantKnowledge));
  dataFolder.file("settings.json", JSON.stringify(settingsArray));

  // Photos: store metadata JSON + blob files from PouchDB attachments
  const photoMetadata = photos.map((p) => ({
    id: p.id,
    version: p.version,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    ...(p.deletedAt != null ? { deletedAt: p.deletedAt } : {}),
    originalStored: p.originalStored,
    ...(p.caption != null ? { caption: p.caption } : {}),
    ...(p.width != null ? { width: p.width } : {}),
    ...(p.height != null ? { height: p.height } : {}),
  }));
  dataFolder.file("photos.json", JSON.stringify(photoMetadata));

  for (const photo of photos) {
    const docId = `photo:${photo.id}`;

    // Thumbnail attachment
    try {
      const thumbnailData = await localDB.getAttachment(docId, "thumbnail");
      if (thumbnailData) {
        photosFolder.file(
          `${photo.id}-thumb.jpg`,
          await blobToArrayBuffer(thumbnailData as Blob | Buffer),
        );
      }
    } catch {
      // Thumbnail attachment doesn't exist
    }

    // Display attachment
    try {
      const displayData = await localDB.getAttachment(docId, "display");
      if (displayData) {
        photosFolder.file(
          `${photo.id}-display.jpg`,
          await blobToArrayBuffer(displayData as Blob | Buffer),
        );
      }
    } catch {
      // Display attachment doesn't exist
    }

    // Original — stored in local-only originals DB (not synced)
    if (photo.originalStored) {
      try {
        const originalBlob = await getOriginal(photo.id);
        if (originalBlob) {
          photosFolder.file(
            `${photo.id}-original.jpg`,
            await blobToArrayBuffer(originalBlob),
          );
        }
      } catch {
        // Original doesn't exist in local store
      }
    }
  }

  return await zip.generateAsync({ type: "blob" });
}

// ─── Table validations (shared with importer) ───

export type TableValidation = {
  filename: string;
  schema: z.ZodSchema;
  countKey: keyof ImportResult["counts"];
  docType: string;
};

export function getTableValidations(): TableValidation[] {
  return [
    {
      filename: "data/plantInstances.json",
      schema: plantInstanceSchema,
      countKey: "plantInstances",
      docType: "plant",
    },
    {
      filename: "data/journalEntries.json",
      schema: journalEntrySchema,
      countKey: "journalEntries",
      docType: "journal",
    },
    { filename: "data/tasks.json", schema: taskSchema, countKey: "tasks", docType: "task" },
    {
      filename: "data/gardenBeds.json",
      schema: gardenBedSchema,
      countKey: "gardenBeds",
      docType: "gardenBed",
    },
    {
      filename: "data/settings.json",
      schema: settingsSchema,
      countKey: "settings",
      docType: "settings",
    },
    {
      filename: "data/photos.json",
      schema: photoImportSchema,
      countKey: "photos",
      docType: "photo",
    },
    {
      filename: "data/seasons.json",
      schema: seasonSchema,
      countKey: "seasons",
      docType: "season",
    },
    {
      filename: "data/plantings.json",
      schema: plantingSchema,
      countKey: "plantings",
      docType: "planting",
    },
    {
      filename: "data/seeds.json",
      schema: seedSchema,
      countKey: "seeds",
      docType: "seed",
    },
    {
      filename: "data/taskRules.json",
      schema: taskRuleSchema,
      countKey: "taskRules",
      docType: "taskRule",
    },
    {
      filename: "data/userPlantKnowledge.json",
      schema: userPlantKnowledgeSchema,
      countKey: "userPlantKnowledge",
      docType: "userPlantKnowledge",
    },
  ];
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
    taskRules: 0,
    userPlantKnowledge: 0,
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
  const tableValidations = getTableValidations();

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
