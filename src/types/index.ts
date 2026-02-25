// All types are derived from Zod schemas via z.infer — single source of truth.

export type { BaseEntity } from "../validation/base.schema.ts";
export type {
  PlantType,
  PlantSource,
  PlantStatus,
  PlantInstance,
} from "../validation/plantInstance.schema.ts";
export type {
  ActivityType,
  MilestoneType,
  WeatherSnapshot,
  JournalEntry,
} from "../validation/journalEntry.schema.ts";
export type { Photo } from "../validation/photo.schema.ts";
export type {
  TaskPriority,
  RecurrenceType,
  Task,
} from "../validation/task.schema.ts";
export type { BedType, GardenBed } from "../validation/gardenBed.schema.ts";
export type { Settings } from "../validation/settings.schema.ts";

// SunExposure is not yet used by any Phase 1 entity schema,
// but exported for Phase 2 readiness.
export type SunExposure = "full_sun" | "partial_shade" | "full_shade";
