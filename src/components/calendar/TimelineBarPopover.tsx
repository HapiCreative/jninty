import { forwardRef } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import { TASK_TYPE_COLORS, TASK_TYPE_LABELS } from "./taskTypeColors.ts";
import type { ScheduleTask } from "../../validation/scheduleTask.schema.ts";

interface TimelineBarPopoverProps {
  task: ScheduleTask;
  anchorRect: DOMRect;
  onToggleComplete: (taskId: string) => void;
  onClose: () => void;
}

const TimelineBarPopover = forwardRef<HTMLDivElement, TimelineBarPopoverProps>(
  function TimelineBarPopover({ task, anchorRect, onToggleComplete, onClose }, ref) {
    const color = TASK_TYPE_COLORS[task.taskType];
    const typeLabel = TASK_TYPE_LABELS[task.taskType];

    // Position below the bar, centered horizontally
    const top = anchorRect.bottom + 4;
    const left = anchorRect.left + anchorRect.width / 2;

    return createPortal(
      <div
        ref={ref}
        role="dialog"
        aria-label={`${task.cropName} ${typeLabel} details`}
        className="fixed z-50 w-56 -translate-x-1/2 rounded-lg bg-surface-elevated p-3 shadow-lg ring-1 ring-border-default"
        style={{ top, left }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {typeLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="rounded p-0.5 text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
            aria-label="Close"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Crop info */}
        <p className="text-sm font-semibold text-text-heading">{task.cropName}</p>
        <p className="text-xs text-text-secondary">{task.varietyName}</p>

        {/* Date */}
        <p className="mt-1.5 text-xs text-text-muted">
          {format(parseISO(task.scheduledDate), "EEEE, MMM d, yyyy")}
        </p>

        {/* Bed */}
        {task.bedName && (
          <p className="mt-1 text-xs text-text-muted">
            Bed: {task.bedName}
          </p>
        )}

        {/* Completion toggle */}
        <div className="mt-3 border-t border-border-default pt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(task.id);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-muted"
          >
            {task.isCompleted ? (
              <>
                <svg className="h-3.5 w-3.5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Mark incomplete</span>
              </>
            ) : (
              <>
                <span className="inline-block h-3.5 w-3.5 rounded border border-border-strong" />
                <span>Mark complete</span>
              </>
            )}
          </button>
        </div>
      </div>,
      document.body,
    );
  },
);

export default TimelineBarPopover;
