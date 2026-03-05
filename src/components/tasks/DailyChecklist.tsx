import { useMemo } from "react";
import { format } from "date-fns";
import ScheduleTaskItem from "./ScheduleTaskItem.tsx";
import type { ScheduleTask } from "../../validation/scheduleTask.schema.ts";
import type { Task } from "../../types";

interface DailyChecklistProps {
  scheduleTasks: ScheduleTask[];
  manualTasks: Task[];
  today: string;
  onCompleteScheduleTask: (task: ScheduleTask) => void;
  onCompleteManualTask: (task: Task) => void;
}

interface BedGroup {
  bedName: string;
  scheduleTasks: ScheduleTask[];
  manualTasks: Task[];
}

export default function DailyChecklist({
  scheduleTasks,
  manualTasks,
  today,
  onCompleteScheduleTask,
  onCompleteManualTask,
}: DailyChecklistProps) {
  const groups = useMemo((): BedGroup[] => {
    const map = new Map<string, BedGroup>();

    for (const task of scheduleTasks) {
      if (task.scheduledDate !== today) continue;
      const bed = task.bedName ?? "No bed";
      let group = map.get(bed);
      if (!group) {
        group = { bedName: bed, scheduleTasks: [], manualTasks: [] };
        map.set(bed, group);
      }
      group.scheduleTasks.push(task);
    }

    for (const task of manualTasks) {
      if (task.dueDate !== today) continue;
      const bed = "No bed";
      let group = map.get(bed);
      if (!group) {
        group = { bedName: bed, scheduleTasks: [], manualTasks: [] };
        map.set(bed, group);
      }
      group.manualTasks.push(task);
    }

    return [...map.values()].sort((a, b) =>
      a.bedName === "No bed" ? 1 : b.bedName === "No bed" ? -1 : a.bedName.localeCompare(b.bedName),
    );
  }, [scheduleTasks, manualTasks, today]);

  const totalTasks = groups.reduce(
    (sum, g) => sum + g.scheduleTasks.length + g.manualTasks.length,
    0,
  );

  return (
    <div>
      <h2 className="font-display text-base font-semibold text-text-heading">
        Today &mdash; {format(new Date(), "MMMM d, yyyy")}
      </h2>

      {totalTasks === 0 ? (
        <p className="mt-4 text-center text-sm text-text-secondary">
          No tasks due today.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {groups.map((group) => (
            <div key={group.bedName}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {group.bedName}
              </h3>
              <div className="mt-1.5 space-y-1.5">
                {group.scheduleTasks.map((task) => (
                  <ScheduleTaskItem
                    key={task.id}
                    task={task}
                    isOverdue={false}
                    onComplete={() => onCompleteScheduleTask(task)}
                  />
                ))}
                {group.manualTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-lg border border-border-default bg-surface p-3"
                  >
                    <button
                      type="button"
                      onClick={() => onCompleteManualTask(task)}
                      aria-label={task.isCompleted ? "Mark incomplete" : "Mark complete"}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-border-strong transition-colors hover:border-focus-ring"
                    >
                      {task.isCompleted && (
                        <svg className="h-3 w-3 text-focus-ring" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                    <span className="text-sm text-text-primary">{task.title}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
