interface HarvestDragModalProps {
  cropName: string;
  onShiftAll: () => void;
  onHarvestOnly: () => void;
  onCancel: () => void;
}

export default function HarvestDragModal({
  cropName,
  onShiftAll,
  onHarvestOnly,
  onCancel,
}: HarvestDragModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-sm rounded-xl bg-surface-elevated p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-text-heading">
          Move harvest for {cropName}
        </h3>
        <p className="mt-1 text-xs text-text-secondary">
          Do you want to move only the harvest date, or shift the entire
          planting schedule?
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onHarvestOnly}
            className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-heading transition-colors hover:bg-surface"
          >
            Harvest only
          </button>
          <button
            type="button"
            onClick={onShiftAll}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-text-on-primary transition-colors hover:bg-primary-hover"
          >
            Shift entire schedule
          </button>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-3 w-full text-center text-xs text-text-muted transition-colors hover:text-text-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
