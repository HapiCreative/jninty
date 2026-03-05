import { useState } from "react";
import { format, parseISO } from "date-fns";
import type { ScheduleDirection } from "../../validation/plantingSchedule.schema.ts";

interface DirectionPickerProps {
  date: string; // ISO date e.g. "2026-04-15"
  cropName: string;
  varietyName: string;
  onConfirm: (direction: ScheduleDirection) => void;
  onCancel: () => void;
}

export default function DirectionPicker({
  date,
  cropName,
  varietyName,
  onConfirm,
  onCancel,
}: DirectionPickerProps) {
  const [direction, setDirection] = useState<ScheduleDirection>("forward");
  const displayDate = format(parseISO(date), "MMMM d, yyyy");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border-default bg-surface-elevated p-5 shadow-xl">
        <h3 className="font-display text-base font-semibold text-text-heading">
          Schedule {cropName} — {varietyName}
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          Selected date: <strong>{displayDate}</strong>
        </p>

        <fieldset className="mt-4 space-y-2">
          <legend className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            How should we use this date?
          </legend>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
              direction === "forward"
                ? "border-primary bg-green-50"
                : "border-border-default hover:border-primary/40"
            }`}
          >
            <input
              type="radio"
              name="direction"
              value="forward"
              checked={direction === "forward"}
              onChange={() => setDirection("forward")}
              className="mt-0.5 accent-primary"
            />
            <div>
              <p className="text-sm font-medium text-text-heading">
                Start seeds on this date
              </p>
              <p className="text-xs text-text-secondary">
                Calculate transplant, harvest, etc. forward from {displayDate}
              </p>
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
              direction === "backward"
                ? "border-primary bg-green-50"
                : "border-border-default hover:border-primary/40"
            }`}
          >
            <input
              type="radio"
              name="direction"
              value="backward"
              checked={direction === "backward"}
              onChange={() => setDirection("backward")}
              className="mt-0.5 accent-primary"
            />
            <div>
              <p className="text-sm font-medium text-text-heading">
                Harvest by this date
              </p>
              <p className="text-xs text-text-secondary">
                Calculate seed start, transplant, etc. backward from{" "}
                {displayDate}
              </p>
            </div>
          </label>
        </fieldset>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-border-default px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(direction)}
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-text-on-primary transition-colors hover:bg-primary-hover"
          >
            Create Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
