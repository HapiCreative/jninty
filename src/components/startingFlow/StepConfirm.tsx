import { format, parseISO } from "date-fns";
import { TASK_TYPE_COLORS } from "../calendar/taskTypeColors.ts";
import type { ComputedDates } from "../../services/schedulingService.ts";

interface StepConfirmProps {
  cropName: string;
  varietyName: string;
  bedName: string | null;
  dates: ComputedDates;
  saving: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export default function StepConfirm({
  cropName,
  varietyName,
  bedName,
  dates,
  saving,
  onConfirm,
  onBack,
}: StepConfirmProps) {
  const dateRows: { label: string; date: string; color: string }[] = [];

  if (dates.seedStartDate) {
    dateRows.push({
      label: "Seed Start",
      date: dates.seedStartDate,
      color: TASK_TYPE_COLORS.seed_start,
    });
  }
  if (dates.bedPrepDate) {
    dateRows.push({
      label: "Bed Prep",
      date: dates.bedPrepDate,
      color: TASK_TYPE_COLORS.bed_prep,
    });
  }
  if (dates.transplantDate) {
    dateRows.push({
      label: "Transplant",
      date: dates.transplantDate,
      color: TASK_TYPE_COLORS.transplant,
    });
  }
  if (dates.cultivateStartDate) {
    dateRows.push({
      label: "Cultivate",
      date: dates.cultivateStartDate,
      color: TASK_TYPE_COLORS.cultivate,
    });
  }
  dateRows.push({
    label: "Harvest Start",
    date: dates.harvestStartDate,
    color: TASK_TYPE_COLORS.harvest,
  });

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
        Confirm Planting
      </h2>

      <div className="mt-4 rounded-lg border border-border-default bg-surface p-4">
        <div className="text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Crop</span>
            <span className="font-medium text-text-primary">{cropName}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-text-muted">Variety</span>
            <span className="font-medium text-text-primary">{varietyName}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-text-muted">Bed</span>
            <span className="font-medium text-text-primary">
              {bedName ?? "No bed"}
            </span>
          </div>
        </div>

        <div className="mt-4 border-t border-border-default pt-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Schedule
          </span>
          <div className="mt-2 space-y-1.5">
            {dateRows.map((row) => (
              <div key={row.label} className="flex items-center gap-2 text-sm">
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span className="text-text-secondary">{row.label}</span>
                <span className="ml-auto font-medium text-text-primary">
                  {format(parseISO(row.date), "MMM d, yyyy")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onConfirm}
        disabled={saving}
        className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {saving ? "Creating..." : "Create Planting"}
      </button>
    </div>
  );
}
