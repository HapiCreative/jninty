import Dexie, { type Table } from "dexie";
import type { PlantInstance } from "../validation/plantInstance.schema.ts";
import type { JournalEntry } from "../validation/journalEntry.schema.ts";
import type { Photo } from "../validation/photo.schema.ts";
import type { Task } from "../validation/task.schema.ts";
import type { GardenBed } from "../validation/gardenBed.schema.ts";
import type { Settings } from "../validation/settings.schema.ts";
import type { Season } from "../validation/season.schema.ts";
import type { Planting } from "../validation/planting.schema.ts";
import type { Seed } from "../validation/seed.schema.ts";

// Settings doesn't extend BaseEntity — wrap it with an id for Dexie.
export type SettingsRecord = { id: string } & Settings;

// Serialized MiniSearch index stored as a JSON string.
export type SearchIndexRecord = { id: string; data: string };

export class JnintyDB extends Dexie {
  plantInstances!: Table<PlantInstance, string>;
  journalEntries!: Table<JournalEntry, string>;
  photos!: Table<Photo, string>;
  tasks!: Table<Task, string>;
  gardenBeds!: Table<GardenBed, string>;
  settings!: Table<SettingsRecord, string>;
  searchIndex!: Table<SearchIndexRecord, string>;
  seasons!: Table<Season, string>;
  plantings!: Table<Planting, string>;
  seeds!: Table<Seed, string>;

  constructor(name = "jninty") {
    super(name);

    // ─── Version 1: Phase 1 MVP ───
    // Indexes per design doc section 5.5 / 5.6.
    this.version(1).stores({
      plantInstances: "id, species, type, status, *tags",
      journalEntries:
        "id, plantInstanceId, bedId, seasonId, activityType, createdAt",
      photos: "id, createdAt",
      tasks: "id, dueDate, isCompleted, seasonId",
      gardenBeds: "id",
      settings: "id",
      searchIndex: "id",
    });

    // ─── Version 2: Phase 2 — Season + Planting model ───
    // Adds seasons and plantings stores. Migrates existing data to link
    // to a default season.
    this.version(2)
      .stores({
        seasons: "id, year, isActive",
        plantings: "id, plantInstanceId, seasonId, bedId",
      })
      .upgrade(async (tx) => {
        const timestamp = new Date().toISOString();
        const currentYear = new Date().getFullYear();
        const seasonId = crypto.randomUUID();

        // 1. Create a default season
        const defaultSeason: Season = {
          id: seasonId,
          name: `${currentYear} Growing Season`,
          year: currentYear,
          startDate: `${currentYear}-01-01`,
          endDate: `${currentYear}-12-31`,
          isActive: true,
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        await tx.table("seasons").add(defaultSeason);

        // 2. Create a Planting for each PlantInstance
        const plants = await tx.table("plantInstances").toArray();
        for (const plant of plants) {
          const planting: Planting = {
            id: crypto.randomUUID(),
            plantInstanceId: plant.id as string,
            seasonId,
            datePlanted: (plant.dateAcquired as string | undefined) ?? undefined,
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          await tx.table("plantings").add(planting);
        }

        // 3. Back-fill seasonId on all JournalEntries
        await tx
          .table("journalEntries")
          .toCollection()
          .modify((entry: Record<string, unknown>) => {
            if (!entry["seasonId"]) {
              entry["seasonId"] = seasonId;
            }
          });

        // 4. Back-fill seasonId on all Tasks
        await tx
          .table("tasks")
          .toCollection()
          .modify((entry: Record<string, unknown>) => {
            if (!entry["seasonId"]) {
              entry["seasonId"] = seasonId;
            }
          });
      });

    // ─── Version 3: Phase 2 — Seed Bank ───
    // Adds seeds store for seed inventory tracking.
    this.version(3).stores({
      seeds: "id, species, expiryDate",
    });

    // ─── Version 4: Phase 2 — Garden Map grid fields ───
    // Adds grid position fields to gardenBeds for the Konva.js map.
    // Existing beds get default position/dimensions so the map can render them.
    this.version(4)
      .stores({
        gardenBeds: "id, type",
      })
      .upgrade(async (tx) => {
        const timestamp = new Date().toISOString();
        // Dexie.modify iterates sequentially within the transaction cursor,
        // so offsetY increments deterministically per bed.
        let offsetY = 0;

        await tx
          .table("gardenBeds")
          .toCollection()
          .modify((bed: Record<string, unknown>) => {
            if (bed["gridX"] == null) {
              bed["gridX"] = 0;
              bed["gridY"] = offsetY;
              bed["gridWidth"] = 4;
              bed["gridHeight"] = 2;
              bed["shape"] = "rectangle";
              bed["color"] = "#7dbf4e";
              bed["version"] = (bed["version"] as number) + 1;
              bed["updatedAt"] = timestamp;
              offsetY += 3;
            }
          });
      });
  }
}

export const db = new JnintyDB();
