import { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
} from "date-fns";
import { TASK_TYPE_COLORS } from "./taskTypeColors.ts";
import type { ScheduleTask } from "../../validation/scheduleTask.schema.ts";
import type { ScheduleTaskType } from "../../validation/scheduleTask.schema.ts";

const MINI_WEEK_DAYS = ["S", "M", "T", "W", "T", "F", "S"];

interface YearlyMiniMonthProps {
  year: number;
  /** 0-indexed month (0 = January) */
  month: number;
  scheduleTasks: ScheduleTask[];
  onMonthClick: (year: number, month: number) => void;
}

export default function YearlyMiniMonth({
  year,
  month,
  scheduleTasks,
  onMonthClick,
}: YearlyMiniMonthProps) {
  const monthDate = useMemo(() => new Date(year, month, 1), [year, month]);
  const today = new Date();

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [monthDate]);

  // Map scheduledDate → Set of task types for that day
  const dayTaskTypes = useMemo(() => {
    const map = new Map<string, Set<ScheduleTaskType>>();
    for (const task of scheduleTasks) {
      const key = task.scheduledDate;
      const existing = map.get(key);
      if (existing) {
        existing.add(task.taskType);
      } else {
        map.set(key, new Set([task.taskType]));
      }
    }
    return map;
  }, [scheduleTasks]);

  return (
    <div className="rounded-lg border border-border-default bg-surface-elevated p-2.5">
      {/* Month header — clickable to drill into monthly view */}
      <button
        type="button"
        onClick={() => onMonthClick(year, month)}
        className="mb-1.5 w-full text-left text-sm font-semibold text-text-heading transition-colors hover:text-primary"
      >
        {format(monthDate, "MMMM")}
      </button>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0">
        {MINI_WEEK_DAYS.map((d, i) => (
          <div
            key={`${d}-${i}`}
            className="text-center text-[10px] leading-tight text-text-muted"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="mt-0.5 grid grid-cols-7 gap-0">
        {calendarDays.map((day) => {
          const inMonth = isSameMonth(day, monthDate);
          const isToday = isSameDay(day, today);
          const dateKey = format(day, "yyyy-MM-dd");
          const taskTypes = dayTaskTypes.get(dateKey);
          const hasTasks = taskTypes != null && taskTypes.size > 0;

          if (!inMonth) {
            return (
              <div key={dateKey} className="h-7" />
            );
          }

          return (
            <div
              key={dateKey}
              className="flex h-7 flex-col items-center justify-start gap-0.5"
            >
              <span
                className={`text-xs leading-tight ${
                  isToday
                    ? "font-bold text-primary"
                    : "text-text-secondary"
                }`}
              >
                {format(day, "d")}
              </span>
              {hasTasks && (
                <div className="flex gap-0.5">
                  {[...taskTypes!].slice(0, 3).map((tt) => (
                    <span
                      key={tt}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: TASK_TYPE_COLORS[tt] }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
