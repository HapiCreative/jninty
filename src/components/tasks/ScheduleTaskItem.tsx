import { format, parseISO } from "date-fns";
import Card from "../ui/Card.tsx";
import { CheckIcon } from "../icons.tsx";
import { TASK_TYPE_COLORS, TASK_TYPE_LABELS } from "../calendar/taskTypeColors.ts";
import type { ScheduleTask } from "../../validation/scheduleTask.schema.ts";

interface ScheduleTaskItemProps {
  task: ScheduleTask;
  isOverdue: boolean;
  onComplete: () => void;
}

export default function ScheduleTaskItem({
  task,
  isOverdue,
  onComplete,
}: ScheduleTaskItemProps) {
  const dueDateFormatted = format(parseISO(task.scheduledDate), "MMM d");
  const color = TASK_TYPE_COLORS[task.taskType];
  const typeLabel = TASK_TYPE_LABELS[task.taskType];

  return (
    <Card
      className={`transition-shadow ${
        isOverdue && !task.isCompleted
          ? "border-terracotta-400/50 bg-terracotta-400/5"
          : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox — 44px touch target wrapping 20px visual checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          aria-label={task.isCompleted ? "Mark incomplete" : "Mark complete"}
          className="flex h-11 w-11 -m-3 shrink-0 items-center justify-center"
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
              task.isCompleted
                ? "border-focus-ring bg-focus-ring"
                : "border-border-strong hover:border-focus-ring"
            }`}
          >
            {task.isCompleted && <CheckIcon className="h-3 w-3 text-white" />}
          </span>
        </button>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium ${
                task.isCompleted
                  ? "text-text-muted line-through"
                  : "text-text-primary"
              }`}
            >
              {task.title}
            </span>

            {/* Task type badge */}
            <span
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white"
              style={{ backgroundColor: color }}
            >
              {typeLabel}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2 text-xs">
            <span
              className={
                isOverdue && !task.isCompleted
                  ? "font-medium text-terracotta-600"
                  : "text-text-secondary"
              }
            >
              {isOverdue && !task.isCompleted ? "Overdue \u2014 " : ""}
              {dueDateFormatted}
            </span>
            <span className="truncate text-text-muted">
              {task.cropName}
              {task.varietyName ? ` \u00b7 ${task.varietyName}` : ""}
            </span>
            {task.bedName && (
              <span className="ml-auto shrink-0 text-text-muted">
                {task.bedName}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
