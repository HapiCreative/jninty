import { useState, useMemo, useCallback } from "react";
import { usePouchQuery } from "../../hooks/usePouchQuery.ts";
import { scheduleTaskRepository } from "../../db/index.ts";
import { useTaskFilter } from "../../hooks/useTaskFilter.ts";
import TaskFilterToolbar from "./TaskFilterToolbar.tsx";
import YearlyMiniMonth from "./YearlyMiniMonth.tsx";
import Skeleton from "../ui/Skeleton.tsx";
import type { ScheduleTask } from "../../validation/scheduleTask.schema.ts";

interface YearlyViewProps {
  onDrillToMonth: (year: number, month: number) => void;
}

export default function YearlyView({ onDrillToMonth }: YearlyViewProps) {
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const filter = useTaskFilter();

  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

  const allYearTasks = usePouchQuery(
    () => scheduleTaskRepository.getByDateRange(yearStart, yearEnd),
    [yearStart, yearEnd],
  );

  // Filter by visible task types
  const filteredTasks = useMemo(() => {
    if (!allYearTasks) return [];
    return allYearTasks.filter((t) => filter.isVisible(t.taskType));
  }, [allYearTasks, filter]);

  // Group tasks by month (0-indexed)
  const tasksByMonth = useMemo(() => {
    const map = new Map<number, ScheduleTask[]>();
    for (let m = 0; m < 12; m++) {
      map.set(m, []);
    }
    for (const task of filteredTasks) {
      // scheduledDate is "YYYY-MM-DD"
      const monthIndex = parseInt(task.scheduledDate.slice(5, 7), 10) - 1;
      map.get(monthIndex)?.push(task);
    }
    return map;
  }, [filteredTasks]);

  const handlePrevYear = useCallback(() => {
    setCurrentYear((y) => y - 1);
  }, []);

  const handleNextYear = useCallback(() => {
    setCurrentYear((y) => y + 1);
  }, []);

  const handleToday = useCallback(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  if (allYearTasks === undefined) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Year navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevYear}
            aria-label="Previous year"
            className="rounded-lg p-1.5 text-text-heading transition-colors hover:bg-surface-muted"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h2 className="font-display text-lg font-semibold text-text-heading">
            {currentYear}
          </h2>
          <button
            type="button"
            onClick={handleNextYear}
            aria-label="Next year"
            className="rounded-lg p-1.5 text-text-heading transition-colors hover:bg-surface-muted"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="ml-1 rounded-lg border border-border-default px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-muted"
          >
            This Year
          </button>
        </div>

        <span className="text-xs text-text-muted">
          {filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Task filter toolbar */}
      <div className="mt-3">
        <TaskFilterToolbar filter={filter} />
      </div>

      {/* 3x4 (mobile) or 4x3 (desktop) grid of mini-months */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
        {Array.from({ length: 12 }).map((_, monthIndex) => (
          <YearlyMiniMonth
            key={monthIndex}
            year={currentYear}
            month={monthIndex}
            scheduleTasks={tasksByMonth.get(monthIndex) ?? []}
            onMonthClick={onDrillToMonth}
          />
        ))}
      </div>
    </div>
  );
}
