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
export type {
  BedType,
  BedShape,
  BedSunExposure,
  GardenBed,
} from "../validation/gardenBed.schema.ts";
export type { Settings } from "../validation/settings.schema.ts";
export type { Season } from "../validation/season.schema.ts";
export type {
  PlantingOutcome,
  Planting,
} from "../validation/planting.schema.ts";
export type { QuantityUnit, Seed } from "../validation/seed.schema.ts";
export type {
  ExpenseCategory,
  Expense,
} from "../validation/expense.schema.ts";
export type {
  PlantKnowledge,
  SunExposure,
  WaterNeeds,
  GrowthRate,
} from "../validation/plantKnowledge.schema.ts";
export type {
  TaskTriggerType,
  TaskRule,
} from "../validation/taskRule.schema.ts";
export type { UserPlantKnowledge } from "../validation/userPlantKnowledge.schema.ts";
