import { ChevronLeftIcon, ChevronRightIcon } from "../icons.tsx";
import TaskFilterToolbar from "./TaskFilterToolbar.tsx";
import type { TaskFilterState } from "../../hooks/useTaskFilter.ts";

export type MonthRange = 1 | 3 | 6 | 12 | 24;

const RANGE_OPTIONS: MonthRange[] = [1, 3, 6, 12, 24];

interface TimelineToolbarProps {
  monthRange: MonthRange;
  onMonthRangeChange: (range: MonthRange) => void;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  filter: TaskFilterState;
}

export default function TimelineToolbar({
  monthRange,
  onMonthRangeChange,
  onToday,
  onPrev,
  onNext,
  filter,
}: TimelineToolbarProps) {
  return (
    <div className="space-y-2 px-3 py-2">
      {/* Top row: navigation + range selector */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous period"
            className="rounded-lg p-1.5 text-text-heading transition-colors hover:bg-surface-muted"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-text-heading transition-colors hover:bg-surface-muted"
          >
            Today
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Next period"
            className="rounded-lg p-1.5 text-text-heading transition-colors hover:bg-surface-muted"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-0.5 rounded-lg bg-surface-muted p-0.5">
          {RANGE_OPTIONS.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => onMonthRangeChange(range)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                monthRange === range
                  ? "bg-surface-elevated text-text-heading shadow-sm"
                  : "text-text-secondary hover:text-text-heading"
              }`}
            >
              {range}m
            </button>
          ))}
        </div>
      </div>

      {/* Bottom row: task type filters */}
      <TaskFilterToolbar filter={filter} />
    </div>
  );
}
