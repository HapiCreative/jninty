import { addWeeks, subWeeks, addDays, parseISO } from "date-fns";
import type { PlantKnowledge } from "../validation/plantKnowledge.schema.ts";
import type { Settings } from "../validation/settings.schema.ts";

export interface DateWindow {
  start: Date;
  end: Date;
}

export interface PlantingWindows {
  indoorStart?: DateWindow;
  transplant?: DateWindow;
  directSow?: DateWindow;
  estimatedHarvest?: DateWindow;
}

const BUFFER_DAYS = 7;

/**
 * Computes planting windows for a plant based on frost dates from settings.
 * Each window includes a 1-week buffer for practical flexibility.
 * If an offset is missing from the plant data, that window is undefined.
 */
export function computePlantingWindows(
  plant: PlantKnowledge,
  settings: Pick<Settings, "lastFrostDate" | "firstFrostDate">,
): PlantingWindows {
  const lastFrost = parseISO(settings.lastFrostDate);
  const windows: PlantingWindows = {};

  // Indoor seed start: lastFrostDate - indoorStartWeeksBeforeLastFrost
  if (plant.indoorStartWeeksBeforeLastFrost != null) {
    const start = subWeeks(lastFrost, plant.indoorStartWeeksBeforeLastFrost);
    windows.indoorStart = {
      start,
      end: addDays(start, BUFFER_DAYS),
    };
  }

  // Transplant: lastFrostDate + transplantWeeksAfterLastFrost
  // (negative values mean before last frost, e.g., broccoli -2 weeks)
  if (plant.transplantWeeksAfterLastFrost != null) {
    const start = addWeeks(lastFrost, plant.transplantWeeksAfterLastFrost);
    windows.transplant = {
      start,
      end: addDays(start, BUFFER_DAYS),
    };
  }

  // Direct sow: may have before-frost offset, after-frost offset, or both
  const hasBefore = plant.directSowWeeksBeforeLastFrost != null;
  const hasAfter = plant.directSowWeeksAfterLastFrost != null;

  if (hasBefore && hasAfter) {
    // Window spans from the before-frost date to the after-frost date + buffer
    const start = subWeeks(lastFrost, plant.directSowWeeksBeforeLastFrost!);
    const afterDate = addWeeks(lastFrost, plant.directSowWeeksAfterLastFrost!);
    windows.directSow = {
      start,
      end: addDays(afterDate, BUFFER_DAYS),
    };
  } else if (hasBefore) {
    const start = subWeeks(lastFrost, plant.directSowWeeksBeforeLastFrost!);
    windows.directSow = {
      start,
      end: addDays(start, BUFFER_DAYS),
    };
  } else if (hasAfter) {
    const start = addWeeks(lastFrost, plant.directSowWeeksAfterLastFrost!);
    windows.directSow = {
      start,
      end: addDays(start, BUFFER_DAYS),
    };
  }

  // Estimated harvest: plantDate + daysToMaturity
  // Use transplant start or direct sow start as the reference planting date
  if (plant.daysToMaturity != null) {
    const plantDate = windows.transplant?.start ?? windows.directSow?.start;
    if (plantDate) {
      const harvestStart = addDays(plantDate, plant.daysToMaturity);
      windows.estimatedHarvest = {
        start: harvestStart,
        end: addDays(harvestStart, BUFFER_DAYS),
      };
    }
  }

  return windows;
}
