export type CalendarView = "timeline" | "monthly" | "yearly";

interface CalendarViewSwitcherProps {
  activeView: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

const VIEW_OPTIONS: { key: CalendarView; label: string }[] = [
  { key: "timeline", label: "Timeline" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

export default function CalendarViewSwitcher({
  activeView,
  onViewChange,
}: CalendarViewSwitcherProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-surface-muted p-0.5">
      {VIEW_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onViewChange(opt.key)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeView === opt.key
              ? "bg-surface-elevated text-text-heading shadow-sm"
              : "text-text-secondary hover:text-text-heading"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
