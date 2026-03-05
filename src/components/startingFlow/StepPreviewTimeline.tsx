import { format, parseISO } from "date-fns";
import { TASK_TYPE_COLORS } from "../calendar/taskTypeColors.ts";
import type { ComputedDates } from "../../services/schedulingService.ts";
import type { ScheduleTaskType } from "../../validation/scheduleTask.schema.ts";

interface DateEntry {
  key: string;
  taskType: ScheduleTaskType;
  label: string;
  date: string;
}

interface StepPreviewTimelineProps {
  dates: ComputedDates;
  cropName: string;
  varietyName: string;
  onDateChange: (key: string, date: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

function buildEntries(dates: ComputedDates): DateEntry[] {
  const entries: DateEntry[] = [];

  if (dates.seedStartDate) {
    entries.push({
      key: "seedStartDate",
      taskType: "seed_start",
      label: "Seed Start",
      date: dates.seedStartDate,
    });
  }
  if (dates.bedPrepDate) {
    entries.push({
      key: "bedPrepDate",
      taskType: "bed_prep",
      label: "Bed Prep",
      date: dates.bedPrepDate,
    });
  }
  if (dates.transplantDate) {
    entries.push({
      key: "transplantDate",
      taskType: "transplant",
      label: "Transplant",
      date: dates.transplantDate,
    });
  }
  if (dates.cultivateStartDate) {
    entries.push({
      key: "cultivateStartDate",
      taskType: "cultivate",
      label: "Cultivate",
      date: dates.cultivateStartDate,
    });
  }
  entries.push({
    key: "harvestStartDate",
    taskType: "harvest",
    label: "Harvest",
    date: dates.harvestStartDate,
  });

  return entries;
}

export default function StepPreviewTimeline({
  dates,
  cropName,
  varietyName,
  onDateChange,
  onConfirm,
  onBack,
}: StepPreviewTimelineProps) {
  const entries = buildEntries(dates);

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-2 text-xs text-text-muted transition-colors hover:text-text-secondary"
      >
        &larr; Back
      </button>

      <h2 className="font-display text-lg font-semibold text-text-heading">
        Preview Timeline
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        <strong>{cropName}</strong> &mdash; {varietyName}
      </p>
      <p className="mt-0.5 text-xs text-text-muted">
        Tap a date to adjust it.
      </p>

      {/* Visual timeline */}
      <div className="mt-4 flex items-center gap-0">
        {entries.map((entry, i) => (
          <div key={entry.key} className="flex items-center">
            {/* Dot */}
            <div
              className="flex flex-col items-center"
              style={{ minWidth: "56px" }}
            >
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: TASK_TYPE_COLORS[entry.taskType] }}
              />
              <span className="mt-1 text-[10px] font-medium text-text-secondary">
                {entry.label}
              </span>
              <span className="text-[10px] text-text-muted">
                {format(parseISO(entry.date), "MMM d")}
              </span>
            </div>
            {/* Connecting line */}
            {i < entries.length - 1 && (
              <div className="h-0.5 flex-1 bg-border-default" style={{ minWidth: "12px" }} />
            )}
          </div>
        ))}
      </div>

      {/* Editable date list */}
      <div className="mt-6 space-y-3">
        {entries.map((entry) => (
          <div key={entry.key} className="flex items-center gap-3">
            <div
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: TASK_TYPE_COLORS[entry.taskType] }}
            />
            <span className="w-20 text-sm font-medium text-text-primary">
              {entry.label}
            </span>
            <input
              type="date"
              value={entry.date}
              onChange={(e) => onDateChange(entry.key, e.target.value)}
              className="flex-1 rounded-lg border border-border-strong bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/25"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onConfirm}
        className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary transition-colors hover:bg-primary-hover"
      >
        Continue
      </button>
    </div>
  );
}
