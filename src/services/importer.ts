import JSZip from "jszip";
import Papa from "papaparse";
import { z } from "zod";
import {
  SCHEMA_VERSION,
  manifestSchema,
  getTableValidations,
  type ImportResult,
  type ExportManifest,
} from "./exporter.ts";
import { localDB, destroyAndRecreate, setupSync } from "../db/pouchdb/client.ts";
import { toPouchDoc } from "../db/pouchdb/utils.ts";
import { saveOriginal, destroyAndRecreateOriginals } from "../db/pouchdb/originalsStore.ts";
import { ensureAllIndexes } from "../db/pouchdb/indexes.ts";
import {
  rebuildIndex,
  startListening,
  stopListening,
} from "../db/pouchdb/search.ts";
import { getSyncConfig } from "./syncConfigStore.ts";
import { plantInstanceSchema } from "../validation/plantInstance.schema.ts";

// ─── Types ───

export type ParsedImport = {
  valid: boolean;
  errors: string[];
  counts: ImportResult["counts"];
  data: Record<string, Array<Record<string, unknown>>> | null;
  zip: JSZip | null;
};

export type ImportWriteResult = {
  inserted: number;
  skipped: number;
  errors: string[];
};

export type CsvImportResult = {
  inserted: number;
  errors: Array<{ row: number; message: string }>;
};

export type ProgressCallback = (step: string, done: number, total: number) => void;

// ─── Parse ZIP ───

export async function parseZip(file: File): Promise<ParsedImport> {
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
    return { valid: false, errors: ["Failed to read ZIP file"], counts, data: null, zip: null };
  }

  // Read and validate manifest
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    return {
      valid: false,
      errors: ["Missing manifest.json in ZIP"],
      counts,
      data: null,
      zip: null,
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
    return { valid: false, errors: [msg], counts, data: null, zip: null };
  }

  if (manifest.schemaVersion > SCHEMA_VERSION) {
    return {
      valid: false,
      errors: [
        `Unsupported schema version ${String(manifest.schemaVersion)} (max supported: ${String(SCHEMA_VERSION)})`,
      ],
      counts,
      data: null,
      zip: null,
    };
  }

  // Parse and validate each data file
  const data: Record<string, Array<Record<string, unknown>>> = {};
  const tableValidations = getTableValidations();

  for (const { filename, schema, countKey } of tableValidations) {
    const dataFile = zip.file(filename);
    if (!dataFile) {
      data[countKey] = [];
      continue;
    }

    let items: unknown[];
    try {
      const raw: unknown = JSON.parse(await dataFile.async("string"));
      if (!Array.isArray(raw)) {
        errors.push(`${filename}: expected an array`);
        data[countKey] = [];
        continue;
      }
      items = raw;
    } catch {
      errors.push(`${filename}: invalid JSON`);
      data[countKey] = [];
      continue;
    }

    const validItems: Array<Record<string, unknown>> = [];
    for (let i = 0; i < items.length; i++) {
      const result = schema.safeParse(items[i]);
      if (result.success) {
        validItems.push(result.data as Record<string, unknown>);
      } else {
        const issues = result.error.issues
          .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
          .join("; ");
        errors.push(`${filename}[${String(i)}]: ${issues}`);
      }
    }
    data[countKey] = validItems;
    counts[countKey] = validItems.length;
  }

  return { valid: errors.length === 0, errors, counts, data, zip };
}

// ─── Helpers ───

/** Read a JSZip file entry as a Buffer (Node.js) or Blob (browser). */
async function readZipEntry(
  entry: JSZip.JSZipObject,
): Promise<Blob | Buffer> {
  if (typeof Buffer !== "undefined") {
    return entry.async("nodebuffer");
  }
  return entry.async("blob");
}

// ─── Write photos helper ───

async function writePhotos(
  parsed: ParsedImport,
  onProgress?: ProgressCallback,
  skipExisting = false,
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const photos = parsed.data?.["photos"] ?? [];
  const errors: string[] = [];
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]!;
    const photoId = photo["id"] as string;
    const docId = `photo:${photoId}`;

    onProgress?.("Importing photos", i + 1, photos.length);

    if (skipExisting) {
      try {
        await localDB.get(docId);
        skipped++;
        continue;
      } catch {
        // Not found — proceed to insert
      }
    }

    // Build PouchDB doc with inline _attachments
    const pouchDoc: Record<string, unknown> = {
      _id: docId,
      docType: "photo",
      id: photo["id"],
      version: photo["version"],
      createdAt: photo["createdAt"],
      updatedAt: photo["updatedAt"],
      originalStored: photo["originalStored"],
    };
    if (photo["deletedAt"] != null) pouchDoc["deletedAt"] = photo["deletedAt"];
    if (photo["caption"] != null) pouchDoc["caption"] = photo["caption"];
    if (photo["width"] != null) pouchDoc["width"] = photo["width"];
    if (photo["height"] != null) pouchDoc["height"] = photo["height"];

    // Collect attachments from ZIP
    const attachments: Record<string, { content_type: string; data: Blob | Buffer }> = {};

    if (parsed.zip) {
      const thumbFile = parsed.zip.file(`photos/${photoId}-thumb.jpg`);
      if (thumbFile) {
        attachments["thumbnail"] = {
          content_type: "image/jpeg",
          data: await readZipEntry(thumbFile),
        };
      }

      const displayFile = parsed.zip.file(`photos/${photoId}-display.jpg`);
      if (displayFile) {
        attachments["display"] = {
          content_type: "image/jpeg",
          data: await readZipEntry(displayFile),
        };
      }

      // Original → separate DB
      if (photo["originalStored"]) {
        const originalFile = parsed.zip.file(`photos/${photoId}-original.jpg`);
        if (originalFile) {
          const data = await readZipEntry(originalFile);
          const blob =
            data instanceof Blob ? data : new Blob([data], { type: "image/jpeg" });
          try {
            await saveOriginal(photoId, blob);
          } catch (err) {
            errors.push(`Photo ${photoId} original: ${err instanceof Error ? err.message : "write failed"}`);
          }
        }
      }
    }

    if (Object.keys(attachments).length > 0) {
      pouchDoc["_attachments"] = attachments;
    }

    try {
      await localDB.put(pouchDoc);
      inserted++;
    } catch (err) {
      errors.push(`Photo ${photoId}: ${err instanceof Error ? err.message : "write failed"}`);
    }
  }

  return { inserted, skipped, errors };
}

// ─── Merge import ───

export async function executeImportMerge(
  parsed: ParsedImport,
  onProgress?: ProgressCallback,
): Promise<ImportWriteResult> {
  if (!parsed.data) {
    return { inserted: 0, skipped: 0, errors: ["No parsed data"] };
  }

  const tableValidations = getTableValidations();
  let totalInserted = 0;
  let totalSkipped = 0;
  const allErrors: string[] = [];

  // Write non-photo entities
  for (const { countKey, docType } of tableValidations) {
    if (countKey === "photos") continue;

    const items = parsed.data[countKey] ?? [];
    if (items.length === 0) continue;

    onProgress?.(`Importing ${countKey}`, 0, items.length);

    for (let i = 0; i < items.length; i++) {
      const entity = items[i]!;
      const entityId = entity["id"] as string;

      // Settings uses a fixed _id
      const pouchId =
        docType === "settings" ? "settings:singleton" : `${docType}:${entityId}`;

      onProgress?.(`Importing ${countKey}`, i + 1, items.length);

      // Check if already exists
      try {
        await localDB.get(pouchId);
        totalSkipped++;
        continue;
      } catch {
        // Not found — insert
      }

      try {
        if (docType === "settings") {
          await localDB.put({
            _id: "settings:singleton",
            docType: "settings",
            ...entity,
          });
        } else {
          await localDB.put(toPouchDoc(entity as { id?: string }, docType));
        }
        totalInserted++;
      } catch (err) {
        allErrors.push(
          `${countKey} ${entityId}: ${err instanceof Error ? err.message : "write failed"}`,
        );
      }
    }
  }

  // Write photos
  const photoResult = await writePhotos(parsed, onProgress, true);
  totalInserted += photoResult.inserted;
  totalSkipped += photoResult.skipped;
  allErrors.push(...photoResult.errors);

  // Rebuild search index
  onProgress?.("Rebuilding search index", 0, 1);
  await rebuildIndex();
  onProgress?.("Rebuilding search index", 1, 1);

  return { inserted: totalInserted, skipped: totalSkipped, errors: allErrors };
}

// ─── Replace import ───

export async function executeImportReplace(
  parsed: ParsedImport,
  onProgress?: ProgressCallback,
): Promise<ImportWriteResult> {
  if (!parsed.data) {
    return { inserted: 0, skipped: 0, errors: ["No parsed data"] };
  }

  const allErrors: string[] = [];
  let totalInserted = 0;

  // 1. Stop search changes feed
  stopListening();

  // 2. Destroy and recreate both databases
  onProgress?.("Resetting database", 0, 2);
  await destroyAndRecreate();
  onProgress?.("Resetting database", 1, 2);
  await destroyAndRecreateOriginals();
  onProgress?.("Resetting database", 2, 2);

  // 3. Recreate docType index
  await ensureAllIndexes();

  const tableValidations = getTableValidations();

  // 4. Write settings first
  const settingsItems = parsed.data["settings"] ?? [];
  if (settingsItems.length > 0) {
    const settings = settingsItems[0]!;
    try {
      await localDB.put({
        _id: "settings:singleton",
        docType: "settings",
        ...settings,
      });
      totalInserted++;
    } catch (err) {
      allErrors.push(
        `settings: ${err instanceof Error ? err.message : "write failed"}`,
      );
    }
  }

  // 5. Write all other entities via bulkDocs per docType
  for (const { countKey, docType } of tableValidations) {
    if (countKey === "settings" || countKey === "photos") continue;

    const items = parsed.data[countKey] ?? [];
    if (items.length === 0) continue;

    onProgress?.(`Importing ${countKey}`, 0, items.length);

    const docs = items.map((entity) =>
      toPouchDoc(entity as { id?: string }, docType),
    );

    try {
      const results = await localDB.bulkDocs(docs);
      let count = 0;
      for (const result of results) {
        if ("ok" in result && result.ok) {
          count++;
        } else if ("error" in result) {
          const errResult = result as PouchDB.Core.Error;
          allErrors.push(
            `${countKey}: ${errResult.message ?? errResult.reason ?? "write failed"}`,
          );
        }
      }
      totalInserted += count;
    } catch (err) {
      allErrors.push(
        `${countKey} bulkDocs: ${err instanceof Error ? err.message : "write failed"}`,
      );
    }

    onProgress?.(`Importing ${countKey}`, items.length, items.length);
  }

  // 6. Write photos
  const photoResult = await writePhotos(parsed, onProgress, false);
  totalInserted += photoResult.inserted;
  allErrors.push(...photoResult.errors);

  // 7. Rebuild search index
  onProgress?.("Rebuilding search index", 0, 1);
  await rebuildIndex();
  onProgress?.("Rebuilding search index", 1, 1);

  // 8. Restart search changes feed
  startListening();

  // 9. Restart sync if configured
  const syncConfig = getSyncConfig();
  if (syncConfig?.enabled) {
    const credentials =
      syncConfig.username && syncConfig.password
        ? { username: syncConfig.username, password: syncConfig.password }
        : undefined;
    setupSync(syncConfig.remoteUrl, credentials);
  }

  return { inserted: totalInserted, skipped: 0, errors: allErrors };
}

// ─── CSV import ───

export type CsvColumnMap = Record<string, string>;

const CSV_FIELD_OPTIONS = [
  "species",
  "type",
  "source",
  "status",
  "nickname",
  "variety",
  "isPerennial",
  "dateAcquired",
  "tags",
  "careNotes",
  "purchasePrice",
  "purchaseStore",
] as const;

export type CsvFieldOption = (typeof CSV_FIELD_OPTIONS)[number];
export { CSV_FIELD_OPTIONS };

/** Heuristic to auto-match CSV headers to PlantInstance fields. */
export function autoMapColumns(
  headers: string[],
): Record<string, string> {
  const map: Record<string, string> = {};
  const matchers: Array<{ field: string; patterns: RegExp }> = [
    { field: "species", patterns: /^(species|plant\s*name|name|plant)$/i },
    { field: "type", patterns: /^(type|category|plant\s*type|kind)$/i },
    { field: "source", patterns: /^(source|origin|acquired\s*from|from)$/i },
    { field: "status", patterns: /^(status|state|condition)$/i },
    { field: "nickname", patterns: /^(nickname|alias|common\s*name|display\s*name)$/i },
    { field: "variety", patterns: /^(variety|cultivar|variant)$/i },
    { field: "isPerennial", patterns: /^(is\s*perennial|perennial)$/i },
    { field: "dateAcquired", patterns: /^(date\s*acquired|acquired|date|purchase\s*date)$/i },
    { field: "tags", patterns: /^(tags|labels|categories)$/i },
    { field: "careNotes", patterns: /^(care\s*notes|notes|care|description)$/i },
    { field: "purchasePrice", patterns: /^(purchase\s*price|price|cost)$/i },
    { field: "purchaseStore", patterns: /^(purchase\s*store|store|vendor|seller|shop)$/i },
  ];

  for (const header of headers) {
    const match = matchers.find((m) => m.patterns.test(header.trim()));
    if (match) {
      map[header] = match.field;
    }
  }

  return map;
}

export function parseCsvFile(
  file: File,
): Promise<{ headers: string[]; rows: Array<Record<string, string>> }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve({
          headers: results.meta.fields ?? [],
          rows: results.data,
        });
      },
      error: (err: Error) => {
        reject(err);
      },
    });
  });
}

export async function importPlantsFromCsv(
  rows: Array<Record<string, string>>,
  columnMap: Record<string, string>,
): Promise<CsvImportResult> {
  const errors: Array<{ row: number; message: string }> = [];
  const validDocs: Array<Record<string, unknown>> = [];

  const now = new Date().toISOString();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const mapped: Record<string, unknown> = {};

    for (const [csvCol, field] of Object.entries(columnMap)) {
      if (!field || field === "-- Skip --") continue;
      const value = row[csvCol];
      if (value == null || value === "") continue;

      switch (field) {
        case "isPerennial":
          mapped[field] = /^(true|yes|1|y)$/i.test(value.trim());
          break;
        case "purchasePrice":
          mapped[field] = parseFloat(value);
          break;
        case "tags":
          mapped[field] = value
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
          break;
        default:
          mapped[field] = value.trim();
      }
    }

    // Fill defaults
    const plant = {
      id: crypto.randomUUID(),
      version: 1,
      createdAt: now,
      updatedAt: now,
      isPerennial: false,
      tags: [],
      ...mapped,
    };

    const result = plantInstanceSchema.safeParse(plant);
    if (result.success) {
      validDocs.push(
        toPouchDoc(result.data as unknown as { id?: string }, "plant"),
      );
    } else {
      const issues = result.error.issues
        .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
        .join("; ");
      errors.push({ row: i + 1, message: issues });
    }
  }

  // Write valid rows
  if (validDocs.length > 0) {
    await localDB.bulkDocs(validDocs);
    await rebuildIndex();
  }

  return { inserted: validDocs.length, errors };
}
