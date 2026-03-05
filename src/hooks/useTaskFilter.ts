import { useState, useCallback } from "react";
import type { ScheduleTaskType } from "../validation/scheduleTask.schema.ts";

const STORAGE_KEY = "jninty-task-filter";

const ALL_TYPES: ScheduleTaskType[] = [
  "seed_start",
  "bed_prep",
  "transplant",
  "cultivate",
  "harvest",
];

function loadFromStorage(): Set<ScheduleTaskType> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      return new Set(parsed.filter((t) => ALL_TYPES.includes(t as ScheduleTaskType)) as ScheduleTaskType[]);
    }
  } catch {
    // Ignore parse errors
  }
  return new Set(ALL_TYPES);
}

function saveToStorage(types: Set<ScheduleTaskType>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...types]));
  } catch {
    // Ignore storage errors
  }
}

export interface TaskFilterState {
  visibleTypes: Set<ScheduleTaskType>;
  toggleType: (type: ScheduleTaskType) => void;
  showAll: () => void;
  hideAll: () => void;
  isVisible: (type: ScheduleTaskType) => boolean;
}

export function useTaskFilter(): TaskFilterState {
  const [visibleTypes, setVisibleTypes] = useState<Set<ScheduleTaskType>>(loadFromStorage);

  const toggleType = useCallback((type: ScheduleTaskType) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      saveToStorage(next);
      return next;
    });
  }, []);

  const showAll = useCallback(() => {
    const all = new Set(ALL_TYPES);
    setVisibleTypes(all);
    saveToStorage(all);
  }, []);

  const hideAll = useCallback(() => {
    const empty = new Set<ScheduleTaskType>();
    setVisibleTypes(empty);
    saveToStorage(empty);
  }, []);

  const isVisible = useCallback(
    (type: ScheduleTaskType) => visibleTypes.has(type),
    [visibleTypes],
  );

  return { visibleTypes, toggleType, showAll, hideAll, isVisible };
}
