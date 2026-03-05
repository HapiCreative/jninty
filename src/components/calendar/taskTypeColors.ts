import type { ScheduleTaskType } from "../../validation/scheduleTask.schema.ts";

export const TASK_TYPE_COLORS: Record<ScheduleTaskType, string> = {
  seed_start: "#22c55e",
  bed_prep: "#eab308",
  transplant: "#ef4444",
  cultivate: "#f97316",
  harvest: "#a855f7",
};

export const TASK_TYPE_LABELS: Record<ScheduleTaskType, string> = {
  seed_start: "Seed",
  bed_prep: "Prep",
  transplant: "Trans",
  cultivate: "Cult",
  harvest: "Harv",
};
