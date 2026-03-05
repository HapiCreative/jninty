import { usePouchQuery } from "../../hooks/usePouchQuery.ts";
import { gardenBedRepository } from "../../db/index.ts";

interface StepSelectBedProps {
  selectedBedId: string | null;
  onSelect: (bedId: string | null, bedName: string | null) => void;
  onBack: () => void;
}

export default function StepSelectBed({
  selectedBedId,
  onSelect,
  onBack,
}: StepSelectBedProps) {
  const beds = usePouchQuery(() => gardenBedRepository.getAll());

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
        Select a Bed
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Choose a garden bed for this planting (optional).
      </p>

      <div className="mt-4 space-y-1.5">
        {/* No bed option */}
        <button
          type="button"
          onClick={() => onSelect(null, null)}
          className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
            selectedBedId === null
              ? "border-primary bg-green-50"
              : "border-border-default hover:bg-surface-muted"
          }`}
        >
          <span className="text-sm text-text-primary">No bed</span>
        </button>

        {beds?.map((bed) => (
          <button
            key={bed.id}
            type="button"
            onClick={() => onSelect(bed.id, bed.name)}
            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
              selectedBedId === bed.id
                ? "border-primary bg-green-50"
                : "border-border-default hover:bg-surface-muted"
            }`}
          >
            <div
              className="h-4 w-4 shrink-0 rounded"
              style={{ backgroundColor: bed.color }}
            />
            <span className="text-sm font-medium text-text-primary">
              {bed.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
