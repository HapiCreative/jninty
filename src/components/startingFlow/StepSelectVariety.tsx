import { getCropById } from "../../data/cropdb/index.ts";
import type { CropVariety } from "../../data/cropdb/cropdb.types.ts";

interface StepSelectVarietyProps {
  cropId: string;
  cropName: string;
  onSelect: (variety: CropVariety) => void;
  onBack: () => void;
}

export default function StepSelectVariety({
  cropId,
  cropName,
  onSelect,
  onBack,
}: StepSelectVarietyProps) {
  const crop = getCropById(cropId);
  const varieties = crop?.varieties ?? [];

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-2 text-xs text-text-muted transition-colors hover:text-text-secondary"
      >
        &larr; Back to crops
      </button>

      <h2 className="font-display text-lg font-semibold text-text-heading">
        Select a Variety
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Varieties for <strong>{cropName}</strong>
      </p>

      {varieties.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">
          No varieties found for this crop.
        </p>
      ) : (
        <div className="mt-4 space-y-1.5">
          {varieties.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v)}
              className="flex w-full items-center justify-between rounded-lg border border-border-default px-3 py-2.5 text-left transition-colors hover:bg-surface-muted"
            >
              <div>
                <span className="text-sm font-medium text-text-primary">
                  {v.name}
                </span>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                  <span>{v.daysToMaturity} days to maturity</span>
                  {v.indoorStart && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                      Indoor start
                    </span>
                  )}
                  {v.directSow && (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                      Direct sow
                    </span>
                  )}
                </div>
              </div>
              <svg
                className="h-4 w-4 shrink-0 text-text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
