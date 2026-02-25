import type { TaskPriority } from "../types/index.ts";
import type { BadgeVariant } from "./plantLabels.ts";

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  normal: "Normal",
  low: "Low",
};

export const PRIORITY_VARIANT: Record<TaskPriority, BadgeVariant> = {
  urgent: "danger",
  normal: "warning",
  low: "default",
};

export const ALL_PRIORITIES: TaskPriority[] = ["urgent", "normal", "low"];

export const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] =
  ALL_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }));
