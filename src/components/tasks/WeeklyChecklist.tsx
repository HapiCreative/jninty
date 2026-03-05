import { useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  formatISO,
  isSameDay,
} from "date-fns";
import ScheduleTaskItem from "./ScheduleTaskItem.tsx";
import type { ScheduleTask } from "../../validation/scheduleTask.schema.ts";
import type { Task } from "../../types";

interface WeeklyChecklistProps {
  scheduleTasks: ScheduleTask[];
  manualTasks: Task[];
  today: string;
  onCompleteScheduleTask: (task: ScheduleTask) => void;
  onCompleteManualTask: (task: Task) => void;
}

interface DayGroup {
  date: Date;
  dateStr: string;
  label: string;
  isToday: boolean;
  scheduleTasks: ScheduleTask[];
  manualTasks: Task[];
}

export default function WeeklyChecklist({
  scheduleTasks,
  manualTasks,
  today,
  onCompleteScheduleTask,
  onCompleteManualTask,
}: WeeklyChecklistProps) {
  const days = useMemo((): DayGroup[] => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const dayDates = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return dayDates.map((date) => {
      const dateStr = formatISO(date, { representation: "date" });
      return {
        date,
        dateStr,
        label: format(date, "EEEE, MMM d"),
        isToday: isSameDay(date, now),
        scheduleTasks: scheduleTasks.filter((t) => t.scheduledDate === dateStr),
        manualTasks: manualTasks.filter((t) => t.dueDate === dateStr),
      };
    });
  }, [scheduleTasks, manualTasks]);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  return (
    <div>
      <h2 className="font-display text-base font-semibold text-text-heading">
        This Week &mdash; {format(weekStart, "MMM d")}&ndash;
        {format(weekEnd, "MMM d, yyyy")}
      </h2>

      <div className="mt-3 space-y-4">
        {days.map((day) => {
          const taskCount =
            day.scheduleTasks.length + day.manualTasks.length;
          return (
            <div key={day.dateStr}>
              <h3
                className={`text-xs font-semibold uppercase tracking-wide ${
                  day.isToday ? "text-green-700" : "text-text-muted"
                }`}
              >
                {day.label}
                {day.isToday && " (Today)"}
              </h3>

              {taskCount === 0 ? (
                <p className="mt-1 text-xs italic text-text-muted">
                  No tasks
                </p>
              ) : (
                <div className="mt-1.5 space-y-1.5">
                  {day.scheduleTasks.map((task) => (
                    <ScheduleTaskItem
                      key={task.id}
                      task={task}
                      isOverdue={task.scheduledDate < today && !task.isCompleted}
                      onComplete={() => onCompleteScheduleTask(task)}
                    />
                  ))}
                  {day.manualTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 rounded-lg border border-border-default bg-surface p-3"
                    >
                      <button
                        type="button"
                        onClick={() => onCompleteManualTask(task)}
                        aria-label={
                          task.isCompleted ? "Mark incomplete" : "Mark complete"
                        }
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-border-strong transition-colors hover:border-focus-ring"
                      >
                        {task.isCompleted && (
                          <svg
                            className="h-3 w-3 text-focus-ring"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                      <span
                        className={`text-sm ${
                          task.isCompleted
                            ? "text-text-muted line-through"
                            : "text-text-primary"
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>
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
