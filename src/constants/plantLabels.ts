import type {
  PlantType,
  PlantSource,
  PlantStatus,
} from "../types/index.ts";
import type { ActivityType } from "../validation/journalEntry.schema.ts";

// ─── Badge variant type (matches Badge component) ───

export type BadgeVariant = "default" | "success" | "warning" | "danger";

// ─── Label maps ───

export const TYPE_LABELS: Record<PlantType, string> = {
  vegetable: "Vegetable",
  herb: "Herb",
  flower: "Flower",
  ornamental: "Ornamental",
  fruit_tree: "Fruit Tree",
  berry: "Berry",
  other: "Other",
};

export const STATUS_LABELS: Record<PlantStatus, string> = {
  active: "Active",
  dormant: "Dormant",
  harvested: "Harvested",
  removed: "Removed",
  dead: "Dead",
};

export const SOURCE_LABELS: Record<PlantSource, string> = {
  seed: "Seed",
  nursery: "Nursery",
  cutting: "Cutting",
  gift: "Gift",
  unknown: "Unknown",
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  watering: "Watering",
  fertilizing: "Fertilizing",
  pruning: "Pruning",
  pest: "Pest",
  disease: "Disease",
  harvest: "Harvest",
  transplant: "Transplant",
  milestone: "Milestone",
  general: "General",
};

// ─── Badge variant maps ───

export const STATUS_VARIANT: Record<PlantStatus, BadgeVariant> = {
  active: "success",
  dormant: "warning",
  harvested: "default",
  removed: "danger",
  dead: "danger",
};

// ─── Option arrays for forms and filters ───

export const ALL_TYPES: PlantType[] = [
  "vegetable",
  "herb",
  "flower",
  "ornamental",
  "fruit_tree",
  "berry",
  "other",
];

export const ALL_STATUSES: PlantStatus[] = [
  "active",
  "dormant",
  "harvested",
  "removed",
  "dead",
];

export const TYPE_OPTIONS: { value: PlantType; label: string }[] =
  ALL_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }));

export const SOURCE_OPTIONS: { value: PlantSource; label: string }[] = [
  { value: "seed", label: "Seed" },
  { value: "nursery", label: "Nursery" },
  { value: "cutting", label: "Cutting" },
  { value: "gift", label: "Gift" },
  { value: "unknown", label: "Unknown" },
];

export const STATUS_OPTIONS: { value: PlantStatus; label: string }[] =
  ALL_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));
