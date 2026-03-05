import { TASK_TYPE_COLORS, TASK_TYPE_LABELS } from "../calendar/taskTypeColors.ts";
import type { ScheduleTaskType } from "../../validation/scheduleTask.schema.ts";

const TASK_TYPES: ScheduleTaskType[] = [
  "seed_start",
  "bed_prep",
  "transplant",
  "cultivate",
  "harvest",
];

interface TaskTypeFilterProps {
  selected: Set<ScheduleTaskType>;
  onChange: (selected: Set<ScheduleTaskType>) => void;
}

export default function TaskTypeFilter({
  selected,
  onChange,
}: TaskTypeFilterProps) {
  function toggle(taskType: ScheduleTaskType) {
    const next = new Set(selected);
    if (next.has(taskType)) {
      next.delete(taskType);
    } else {
      next.add(taskType);
    }
    onChange(next);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {TASK_TYPES.map((type) => {
        const active = selected.has(type);
        const color = TASK_TYPE_COLORS[type];
        return (
          <button
            key={type}
            type="button"
            onClick={() => toggle(type)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              active
                ? "text-white"
                : "bg-surface-muted text-text-secondary hover:bg-surface"
            }`}
            style={active ? { backgroundColor: color } : undefined}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            {TASK_TYPE_LABELS[type]}
          </button>
        );
      })}
    </div>
  );
}
