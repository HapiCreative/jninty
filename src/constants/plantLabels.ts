import type {
  PlantType,
  PlantSource,
  PlantStatus,
} from "../types/index.ts";
import type {
  ActivityType,
  MilestoneType,
} from "../validation/journalEntry.schema.ts";

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

// ─── Activity type arrays ───

export const ALL_ACTIVITY_TYPES: ActivityType[] = [
  "watering",
  "fertilizing",
  "pruning",
  "pest",
  "disease",
  "harvest",
  "transplant",
  "milestone",
  "general",
];

export const ACTIVITY_OPTIONS: { value: ActivityType; label: string }[] =
  ALL_ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_LABELS[t] }));

// ─── Milestone labels ───

export const MILESTONE_LABELS: Record<MilestoneType, string> = {
  first_sprout: "First Sprout",
  first_flower: "First Flower",
  first_fruit: "First Fruit",
  peak_harvest: "Peak Harvest",
  other: "Other",
};

export const ALL_MILESTONE_TYPES: MilestoneType[] = [
  "first_sprout",
  "first_flower",
  "first_fruit",
  "peak_harvest",
  "other",
];

export const MILESTONE_OPTIONS: { value: MilestoneType; label: string }[] =
  ALL_MILESTONE_TYPES.map((m) => ({ value: m, label: MILESTONE_LABELS[m] }));
