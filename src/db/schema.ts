import Dexie, { type Table } from "dexie";
import type { PlantInstance } from "../validation/plantInstance.schema.ts";
import type { JournalEntry } from "../validation/journalEntry.schema.ts";
import type { Photo } from "../validation/photo.schema.ts";
import type { Task } from "../validation/task.schema.ts";
import type { GardenBed } from "../validation/gardenBed.schema.ts";
import type { Settings } from "../validation/settings.schema.ts";

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

    // ─── Version 2 placeholder (Phase 2) ───
    // Will add: seasons, plantings, seeds, taskRules stores.
    // Will run data migration to split PlantInstance → PlantInstance + Planting.
    //
    // db.version(2).stores({
    //   seasons: "id, year, isActive",
    //   plantings: "id, plantInstanceId, seasonId, bedId",
    //   seeds: "id, species, expiryDate",
    //   taskRules: "id, isBuiltIn",
    //   // existing stores keep their indexes (only list changed ones)
    // }).upgrade(tx => {
    //   // migration logic here
    // });
  }
}

export const db = new JnintyDB();
