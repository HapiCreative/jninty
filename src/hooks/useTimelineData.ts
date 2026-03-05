import { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  addMonths,
  eachMonthOfInterval,
  getDaysInMonth,
  format,
  isSameDay,
  parseISO,
} from "date-fns";
import { usePouchQuery } from "./usePouchQuery.ts";
import { scheduleTaskRepository } from "../db/index.ts";
import type { ScheduleTask } from "../validation/scheduleTask.schema.ts";
import type { ScheduleTaskType } from "../validation/scheduleTask.schema.ts";

/** Default visual duration (in days) per task type */
const TASK_SPAN_DAYS: Record<ScheduleTaskType, number> = {
  seed_start: 3,
  bed_prep: 2,
  transplant: 3,
  cultivate: 5,
  harvest: 7,
};

/** Compute the bar span for a task, clamped to the month boundary */
export function computeBarSpan(
  taskType: ScheduleTaskType,
  startDay: number,
  daysInMonth: number,
): { startDay: number; endDay: number } {
  const span = TASK_SPAN_DAYS[taskType];
  const endDay = Math.min(startDay + span - 1, daysInMonth);
  return { startDay, endDay };
}

export interface TimelineBar {
  task: ScheduleTask;
  startDay: number; // 1-based day of month
  endDay: number; // 1-based day of month (same as start for single-day tasks)
}

export interface MonthRow {
  monthDate: Date; // First day of month
  label: string; // e.g. "Mar 2026"
  daysInMonth: number;
  bars: TimelineBar[];
  hasToday: boolean;
  todayDay: number | null; // 1-based day if today is in this month
}

export function useTimelineData(
  startDate: Date,
  monthCount: number,
): { monthRows: MonthRow[]; scheduleTasks: ScheduleTask[] | undefined; loading: boolean } {
  const endDate = endOfMonth(addMonths(startDate, monthCount - 1));
  const startStr = format(startOfMonth(startDate), "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  const scheduleTasks = usePouchQuery(
    () => scheduleTaskRepository.getByDateRange(startStr, endStr),
    [startStr, endStr],
  );

  const monthRows = useMemo(() => {
    if (!scheduleTasks) return [];

    const months = eachMonthOfInterval({
      start: startOfMonth(startDate),
      end: endDate,
    });

    const today = new Date();

    return months.map((monthDate): MonthRow => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const daysCount = getDaysInMonth(monthDate);
      const isCurrentMonth = isSameDay(startOfMonth(today), monthStart);

      // Find tasks that fall within this month
      const bars: TimelineBar[] = [];
      for (const task of scheduleTasks) {
        const taskDate = parseISO(task.scheduledDate);
        if (taskDate >= monthStart && taskDate <= monthEnd) {
          const day = taskDate.getDate();
          const { startDay, endDay } = computeBarSpan(task.taskType, day, daysCount);
          bars.push({
            task,
            startDay,
            endDay,
          });
        }
      }

      return {
        monthDate,
        label: format(monthDate, "MMM yyyy"),
        daysInMonth: daysCount,
        bars,
        hasToday: isCurrentMonth,
        todayDay: isCurrentMonth ? today.getDate() : null,
      };
    });
  }, [scheduleTasks, startDate, endDate]);

  return {
    monthRows,
    scheduleTasks,
    loading: scheduleTasks === undefined,
  };
}

/**
 * Get all unique schedule IDs from a set of tasks, for grouping bars by planting.
 */
export function groupBarsBySchedule(
  bars: TimelineBar[],
): Map<string, TimelineBar[]> {
  const groups = new Map<string, TimelineBar[]>();
  for (const bar of bars) {
    const key = bar.task.plantingScheduleId;
    const existing = groups.get(key);
    if (existing) {
      existing.push(bar);
    } else {
      groups.set(key, [bar]);
    }
  }
  return groups;
}
