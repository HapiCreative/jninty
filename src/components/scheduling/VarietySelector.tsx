import { getCropGroup, builtInEntryId } from "../../services/knowledgeBase.ts";
import type { PlantKnowledge } from "../../validation/plantKnowledge.schema.ts";

interface VarietySelectorProps {
  cropId: string;
  cropName: string;
  onSelect: (entry: PlantKnowledge) => void;
  onBack: () => void;
}

export default function VarietySelector({
  cropId,
  cropName,
  onSelect,
  onBack,
}: VarietySelectorProps) {
  const entries = getCropGroup(cropId).filter((e) => e.scheduling != null);

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-1 text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-heading"
          aria-label="Back to search"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-text-heading">{cropName}</h3>
      </div>

      <ul className="mt-2 space-y-1">
        {entries.map((entry) => (
          <li key={builtInEntryId(entry.species, entry.variety)}>
            <button
              type="button"
              onClick={() => onSelect(entry)}
              className="flex w-full items-baseline justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
            >
              <span className="font-medium text-text-heading">
                {entry.variety ?? entry.commonName}
              </span>
              <span className="text-xs text-text-muted">
                {entry.daysToMaturity}d to maturity
              </span>
            </button>
          </li>
        ))}
      </ul>

      {entries.length === 0 && (
        <p className="mt-3 text-center text-xs text-text-muted">
          No varieties found for this crop.
        </p>
      )}
    </div>
  );
}
