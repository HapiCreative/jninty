import { useState } from "react";
import { formatISO, startOfDay } from "date-fns";
import type { ScheduleDirection } from "../../validation/plantingSchedule.schema.ts";

interface StepSetDateProps {
  onConfirm: (date: string, direction: ScheduleDirection) => void;
  onBack: () => void;
}

export default function StepSetDate({ onConfirm, onBack }: StepSetDateProps) {
  const [direction, setDirection] = useState<ScheduleDirection>("forward");
  const [date, setDate] = useState(
    () => formatISO(startOfDay(new Date()), { representation: "date" }),
  );

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
        Set Your Target Date
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Choose a starting point for scheduling.
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-3 rounded-lg border border-border-default p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-green-50">
          <input
            type="radio"
            name="direction"
            value="forward"
            checked={direction === "forward"}
            onChange={() => setDirection("forward")}
            className="mt-0.5"
          />
          <div>
            <span className="text-sm font-medium text-text-primary">
              I want to start seeds on this date
            </span>
            <p className="text-xs text-text-muted">
              Schedule works forward from seed start.
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 rounded-lg border border-border-default p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-green-50">
          <input
            type="radio"
            name="direction"
            value="backward"
            checked={direction === "backward"}
            onChange={() => setDirection("backward")}
            className="mt-0.5"
          />
          <div>
            <span className="text-sm font-medium text-text-primary">
              I want to harvest by this date
            </span>
            <p className="text-xs text-text-muted">
              Schedule works backward from harvest target.
            </p>
          </div>
        </label>
      </div>

      <div className="mt-4">
        <label
          htmlFor="wizard-date"
          className="block text-sm font-medium text-text-secondary"
        >
          Date
        </label>
        <input
          id="wizard-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/25"
        />
      </div>

      <button
        type="button"
        onClick={() => onConfirm(date, direction)}
        disabled={!date}
        className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        Preview Timeline
      </button>
    </div>
  );
}
