export type TaskOrigin = "all" | "manual" | "schedule";

interface TaskOriginFilterProps {
  value: TaskOrigin;
  onChange: (value: TaskOrigin) => void;
}

const OPTIONS: { value: TaskOrigin; label: string }[] = [
  { value: "all", label: "All" },
  { value: "manual", label: "Manual" },
  { value: "schedule", label: "Schedule" },
];

export default function TaskOriginFilter({
  value,
  onChange,
}: TaskOriginFilterProps) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border-strong">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-primary text-text-on-primary"
              : "bg-surface text-text-secondary hover:bg-surface-muted"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
