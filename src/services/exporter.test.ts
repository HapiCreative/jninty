import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import JSZip from "jszip";
import { db } from "../db/schema.ts";
import {
  exportAll,
  importFromZip,
  triggerDownload,
  type ExportManifest,
} from "./exporter.ts";
import { saveAs } from "file-saver";

vi.mock("file-saver", () => ({ saveAs: vi.fn() }));

// ─── DB setup ───

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Helpers ───

const timestamp = "2026-03-15T10:00:00.000Z";

function makePlant(overrides?: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    species: "Solanum lycopersicum",
    type: "vegetable" as const,
    isPerennial: false,
    source: "seed" as const,
    status: "active" as const,
    tags: ["tomato"],
    ...overrides,
  };
}

function makeJournalEntry(overrides?: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    activityType: "watering" as const,
    body: "Watered the tomatoes",
    photoIds: [] as string[],
    isMilestone: false,
    seasonId: "00000000-0000-0000-0000-000000000099",
    ...overrides,
  };
}

function makeTask(overrides?: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    title: "Water tomatoes",
    dueDate: "2026-03-16",
    priority: "normal" as const,
    isCompleted: false,
    ...overrides,
  };
}

function makeGardenBed(overrides?: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    name: "Raised Bed 1",
    type: "vegetable_bed" as const,
    ...overrides,
  };
}

function makeSettings() {
  return {
    growingZone: "7b",
    lastFrostDate: "2026-04-15",
    firstFrostDate: "2026-10-20",
    gridUnit: "feet" as const,
    temperatureUnit: "fahrenheit" as const,
    theme: "light" as const,
    keepOriginalPhotos: false,
    dbSchemaVersion: 1,
    exportVersion: 1,
  };
}

function makeManifest(
  overrides?: Partial<ExportManifest>,
): ExportManifest {
  return {
    exportVersion: 1,
    schemaVersion: 3,
    exportedAt: timestamp,
    appVersion: "0.1.0",
    ...overrides,
  };
}

async function buildZip(
  manifest: ExportManifest,
  data: Record<string, unknown[]>,
  photos?: Array<{ id: string; thumbBlob: Blob; displayBlob?: Blob }>,
): Promise<File> {
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest));

  const dataFolder = zip.folder("data")!;
  for (const [name, items] of Object.entries(data)) {
    dataFolder.file(`${name}.json`, JSON.stringify(items));
  }

  if (photos) {
    const photosFolder = zip.folder("photos")!;
    for (const photo of photos) {
      photosFolder.file(`${photo.id}-thumb.jpg`, photo.thumbBlob);
      if (photo.displayBlob) {
        photosFolder.file(`${photo.id}-display.jpg`, photo.displayBlob);
      }
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], "test-export.zip", {
    type: "application/zip",
  });
}

// ─── exportAll ───

describe("exportAll", () => {
  it("creates a valid ZIP with correct structure", async () => {
    // Seed the database
    const plant = makePlant();
    const entry = makeJournalEntry();
    const task = makeTask();
    const bed = makeGardenBed();

    await db.plantInstances.add(plant);
    await db.journalEntries.add(entry);
    await db.tasks.add(task);
    await db.gardenBeds.add(bed);
    await db.settings.add({ id: "singleton", ...makeSettings() });

    const thumbBlob = new Blob([new Uint8Array(100)], {
      type: "image/jpeg",
    });
    const displayBlob = new Blob([new Uint8Array(500)], {
      type: "image/jpeg",
    });
    const photoId = crypto.randomUUID();

    // fake-indexeddb doesn't preserve Blob objects through structured clone,
    // so mock db.photos.toArray() to return real Blobs.
    vi.spyOn(db.photos, "toArray").mockResolvedValue([
      {
        id: photoId,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        thumbnailBlob: thumbBlob,
        displayBlob: displayBlob,
        originalStored: false,
      },
    ]);

    const blob = await exportAll();
    expect(blob).toBeInstanceOf(Blob);

    const zip = await JSZip.loadAsync(blob);

    // Verify manifest
    const manifestRaw = await zip.file("manifest.json")!.async("string");
    const manifest: unknown = JSON.parse(manifestRaw);
    expect(manifest).toMatchObject({
      exportVersion: 1,
      schemaVersion: 3,
      appVersion: "0.0.0-test",
    });
    expect(
      (manifest as ExportManifest).exportedAt,
    ).toBeDefined();

    // Verify data files exist
    expect(zip.file("data/plantInstances.json")).not.toBeNull();
    expect(zip.file("data/journalEntries.json")).not.toBeNull();
    expect(zip.file("data/tasks.json")).not.toBeNull();
    expect(zip.file("data/gardenBeds.json")).not.toBeNull();
    expect(zip.file("data/settings.json")).not.toBeNull();
    expect(zip.file("data/photos.json")).not.toBeNull();
    expect(zip.file("data/seasons.json")).not.toBeNull();
    expect(zip.file("data/plantings.json")).not.toBeNull();
    expect(zip.file("data/seeds.json")).not.toBeNull();

    // Verify data content
    const plants: unknown = JSON.parse(
      await zip.file("data/plantInstances.json")!.async("string"),
    );
    expect(plants).toHaveLength(1);

    const entries: unknown = JSON.parse(
      await zip.file("data/journalEntries.json")!.async("string"),
    );
    expect(entries).toHaveLength(1);

    const tasks: unknown = JSON.parse(
      await zip.file("data/tasks.json")!.async("string"),
    );
    expect(tasks).toHaveLength(1);

    const beds: unknown = JSON.parse(
      await zip.file("data/gardenBeds.json")!.async("string"),
    );
    expect(beds).toHaveLength(1);

    const settings: unknown = JSON.parse(
      await zip.file("data/settings.json")!.async("string"),
    );
    expect(settings).toHaveLength(1);

    // Verify photo metadata
    const photoMeta: unknown = JSON.parse(
      await zip.file("data/photos.json")!.async("string"),
    );
    expect(photoMeta).toHaveLength(1);

    // Verify photo blobs in photos/ folder
    expect(zip.file(`photos/${photoId}-thumb.jpg`)).not.toBeNull();
    expect(zip.file(`photos/${photoId}-display.jpg`)).not.toBeNull();
  });

  it("excludes soft-deleted records", async () => {
    const plant = makePlant({ deletedAt: timestamp });
    await db.plantInstances.add(plant);

    const blob = await exportAll();
    const zip = await JSZip.loadAsync(blob);
    const plants: unknown = JSON.parse(
      await zip.file("data/plantInstances.json")!.async("string"),
    );
    expect(plants).toHaveLength(0);
  });

  it("handles empty database", async () => {
    const blob = await exportAll();
    const zip = await JSZip.loadAsync(blob);

    const plants: unknown = JSON.parse(
      await zip.file("data/plantInstances.json")!.async("string"),
    );
    expect(plants).toHaveLength(0);

    expect(zip.file("manifest.json")).not.toBeNull();
  });

  it("omits displayBlob file when photo has no display blob", async () => {
    const photoId = crypto.randomUUID();
    const thumbBlob = new Blob([new Uint8Array(50)], {
      type: "image/jpeg",
    });

    vi.spyOn(db.photos, "toArray").mockResolvedValue([
      {
        id: photoId,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        thumbnailBlob: thumbBlob,
        originalStored: false,
      },
    ]);

    const blob = await exportAll();
    const zip = await JSZip.loadAsync(blob);

    expect(zip.file(`photos/${photoId}-thumb.jpg`)).not.toBeNull();
    expect(zip.file(`photos/${photoId}-display.jpg`)).toBeNull();
  });
});

// ─── importFromZip ───

describe("importFromZip", () => {
  it("validates good data and returns correct counts", async () => {
    const file = await buildZip(makeManifest(), {
      plantInstances: [makePlant()],
      journalEntries: [makeJournalEntry(), makeJournalEntry()],
      tasks: [makeTask()],
      gardenBeds: [makeGardenBed()],
      settings: [makeSettings()],
      photos: [
        {
          id: crypto.randomUUID(),
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
          originalStored: false,
        },
      ],
    });

    const result = await importFromZip(file);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.counts).toEqual({
      plantInstances: 1,
      journalEntries: 2,
      tasks: 1,
      gardenBeds: 1,
      settings: 1,
      photos: 1,
      seasons: 0,
      plantings: 0,
      seeds: 0,
    });
  });

  it("rejects non-ZIP files", async () => {
    const file = new File(["not a zip"], "bad.zip", {
      type: "application/zip",
    });

    const result = await importFromZip(file);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Failed to read ZIP file");
  });

  it("rejects ZIP without manifest", async () => {
    const zip = new JSZip();
    zip.file("data/plantInstances.json", "[]");
    const blob = await zip.generateAsync({ type: "blob" });
    const file = new File([blob], "no-manifest.zip");

    const result = await importFromZip(file);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing manifest.json in ZIP");
  });

  it("rejects unsupported schema version", async () => {
    const file = await buildZip(makeManifest({ schemaVersion: 99 }), {});

    const result = await importFromZip(file);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Unsupported schema version 99");
  });

  it("reports validation errors for bad entity data", async () => {
    const file = await buildZip(makeManifest(), {
      plantInstances: [
        {
          // Missing required fields: species, type, etc.
          id: crypto.randomUUID(),
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    });

    const result = await importFromZip(file);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("plantInstances.json[0]");
    expect(result.counts.plantInstances).toBe(0);
  });

  it("reports specific field-level errors", async () => {
    const file = await buildZip(makeManifest(), {
      tasks: [
        {
          id: "not-a-uuid",
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
          title: "Test",
          dueDate: "2026-03-16",
          priority: "normal",
          isCompleted: false,
        },
      ],
    });

    const result = await importFromZip(file);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("id");
  });

  it("handles missing data files gracefully (0 count)", async () => {
    const file = await buildZip(makeManifest(), {});

    const result = await importFromZip(file);

    expect(result.valid).toBe(true);
    expect(result.counts).toEqual({
      plantInstances: 0,
      journalEntries: 0,
      tasks: 0,
      gardenBeds: 0,
      settings: 0,
      photos: 0,
      seasons: 0,
      plantings: 0,
      seeds: 0,
    });
  });

  it("rejects non-array data files", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify(makeManifest()));
    const dataFolder = zip.folder("data")!;
    dataFolder.file(
      "plantInstances.json",
      JSON.stringify({ not: "an array" }),
    );
    const blob = await zip.generateAsync({ type: "blob" });
    const file = new File([blob], "bad-data.zip");

    const result = await importFromZip(file);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("expected an array");
  });

  it("rejects invalid JSON in data files", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify(makeManifest()));
    const dataFolder = zip.folder("data")!;
    dataFolder.file("plantInstances.json", "{ broken json");
    const blob = await zip.generateAsync({ type: "blob" });
    const file = new File([blob], "bad-json.zip");

    const result = await importFromZip(file);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("invalid JSON");
  });

  it("validates mix of good and bad records", async () => {
    const file = await buildZip(makeManifest(), {
      plantInstances: [
        makePlant(),
        { id: "bad", version: 1 }, // invalid
        makePlant(),
      ],
    });

    const result = await importFromZip(file);

    expect(result.valid).toBe(false);
    expect(result.counts.plantInstances).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("plantInstances.json[1]");
  });

  it("rejects invalid manifest JSON", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", "not json");
    const blob = await zip.generateAsync({ type: "blob" });
    const file = new File([blob], "bad-manifest.zip");

    const result = await importFromZip(file);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Invalid manifest");
  });
});

// ─── triggerDownload ───

describe("triggerDownload", () => {
  it("calls saveAs with blob and filename", () => {
    const blob = new Blob(["test"]);
    triggerDownload(blob, "export.zip");
    expect(saveAs).toHaveBeenCalledWith(blob, "export.zip");
  });
});
