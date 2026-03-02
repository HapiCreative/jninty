import type { SunExposure, WaterNeeds, GrowthRate } from "../validation/plantKnowledge.schema.ts";
import type { KnowledgeSource } from "../services/knowledgeBaseTypes.ts";

// ─── Human-readable label maps ───

export const SUN_LABELS: Record<SunExposure, string> = {
  full_sun: "Full Sun",
  partial_shade: "Partial Shade",
  full_shade: "Full Shade",
};

export const WATER_LABELS: Record<WaterNeeds, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

export const GROWTH_RATE_LABELS: Record<GrowthRate, string> = {
  slow: "Slow",
  moderate: "Moderate",
  fast: "Fast",
};

export const SOURCE_LABELS: Record<KnowledgeSource, string> = {
  builtin: "Built-in",
  custom: "Custom",
};

// ─── Option arrays for form selects ───

export const SUN_OPTIONS: { value: SunExposure; label: string }[] = [
  { value: "full_sun", label: "Full Sun" },
  { value: "partial_shade", label: "Partial Shade" },
  { value: "full_shade", label: "Full Shade" },
];

export const WATER_OPTIONS: { value: WaterNeeds; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
];

export const GROWTH_RATE_OPTIONS: { value: GrowthRate; label: string }[] = [
  { value: "slow", label: "Slow" },
  { value: "moderate", label: "Moderate" },
  { value: "fast", label: "Fast" },
];
