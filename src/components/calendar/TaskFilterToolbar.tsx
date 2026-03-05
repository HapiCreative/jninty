import type { TaskFilterState } from "../../hooks/useTaskFilter.ts";
import type { ScheduleTaskType } from "../../validation/scheduleTask.schema.ts";
import { TASK_TYPE_COLORS } from "./taskTypeColors.ts";

const TASK_TYPE_CONFIG: {
  type: ScheduleTaskType;
  label: string;
  color: string;
  bgChecked: string;
  bgUnchecked: string;
}[] = [
  {
    type: "seed_start",
    label: "Seeding",
    color: TASK_TYPE_COLORS.seed_start,
    bgChecked: "bg-green-100 text-green-800 border-green-300",
    bgUnchecked: "bg-surface-muted text-text-muted border-border-default",
  },
  {
    type: "bed_prep",
    label: "Bed Prep",
    color: TASK_TYPE_COLORS.bed_prep,
    bgChecked: "bg-yellow-100 text-yellow-800 border-yellow-300",
    bgUnchecked: "bg-surface-muted text-text-muted border-border-default",
  },
  {
    type: "transplant",
    label: "Transplant",
    color: TASK_TYPE_COLORS.transplant,
    bgChecked: "bg-red-100 text-red-800 border-red-300",
    bgUnchecked: "bg-surface-muted text-text-muted border-border-default",
  },
  {
    type: "cultivate",
    label: "Cultivate",
    color: TASK_TYPE_COLORS.cultivate,
    bgChecked: "bg-orange-100 text-orange-800 border-orange-300",
    bgUnchecked: "bg-surface-muted text-text-muted border-border-default",
  },
  {
    type: "harvest",
    label: "Harvest",
    color: TASK_TYPE_COLORS.harvest,
    bgChecked: "bg-purple-100 text-purple-800 border-purple-300",
    bgUnchecked: "bg-surface-muted text-text-muted border-border-default",
  },
];

interface TaskFilterToolbarProps {
  filter: TaskFilterState;
}

export default function TaskFilterToolbar({ filter }: TaskFilterToolbarProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TASK_TYPE_CONFIG.map((cfg) => {
        const checked = filter.isVisible(cfg.type);
        return (
          <button
            key={cfg.type}
            type="button"
            onClick={() => filter.toggleType(cfg.type)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              checked ? cfg.bgChecked : cfg.bgUnchecked
            }`}
            aria-pressed={checked}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: cfg.color, opacity: checked ? 1 : 0.3 }}
            />
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}
