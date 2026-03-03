import type { CompanionReport } from "../../services/companionAnalysis.ts";

interface CompanionReportSectionProps {
  report: CompanionReport;
}

export default function CompanionReportSection({
  report,
}: CompanionReportSectionProps) {
  const { goodPairings, badPairings, suggestions } = report;

  // Hide entirely when no companion data exists
  if (
    goodPairings.length === 0 &&
    badPairings.length === 0 &&
    suggestions.length === 0
  ) {
    return null;
  }

  return (
    <div className="mt-5 space-y-3">
      <h4 className="text-sm font-medium text-text-secondary">
        Companion Planting
      </h4>

      {/* Conflicts (bad pairings) */}
      {badPairings.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3">
          <h5 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-700">
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            Conflicts
          </h5>
          <ul className="space-y-1">
            {badPairings.map((p) => (
              <li key={`${p.plantA.id}-${p.plantB.id}-${p.tag}`} className="text-xs text-red-600">
                {p.plantA.name} & {p.plantB.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Good pairings */}
      {goodPairings.length > 0 && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3">
          <h5 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-green-700">
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Good Pairings
          </h5>
          <ul className="space-y-1">
            {goodPairings.map((p) => (
              <li key={`${p.plantA.id}-${p.plantB.id}-${p.tag}`} className="text-xs text-green-600">
                {p.plantA.name} & {p.plantB.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface p-3">
          <h5 className="mb-1.5 text-xs font-semibold text-text-secondary">
            Suggestions
          </h5>
          <ul className="space-y-1">
            {suggestions.map((s) => (
              <li key={`${s.forPlant.id}-${s.suggestedCompanion}`} className="text-xs text-text-secondary">
                Consider adding{" "}
                <span className="font-medium capitalize">
                  {s.suggestedCompanion}
                </span>{" "}
                near your {s.forPlant.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
