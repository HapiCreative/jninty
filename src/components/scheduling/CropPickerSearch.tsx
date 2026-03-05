import { useState, useMemo } from "react";
import type { CropSearchResult } from "../../services/cropDBSearch.ts";

interface CropPickerSearchProps {
  onSearch: (query: string) => CropSearchResult[];
  onSelect: (result: CropSearchResult) => void;
}

export default function CropPickerSearch({
  onSearch,
  onSelect,
}: CropPickerSearchProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    return onSearch(query);
  }, [query, onSearch]);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search crops..."
        className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        autoFocus
      />

      {results.length > 0 && (
        <ul className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-border-default bg-surface-elevated">
          {results.map((result) => (
            <li key={`${result.cropId}-${result.id}`}>
              <button
                type="button"
                onClick={() => onSelect(result)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
              >
                <span className="font-medium text-text-heading">
                  {result.cropName}
                </span>
                <span className="text-text-secondary">
                  {result.varietyName}
                </span>
                {result.source === "custom" && (
                  <span className="ml-auto rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                    Custom
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim().length >= 2 && results.length === 0 && (
        <p className="mt-2 text-center text-xs text-text-muted">
          No crops found for &ldquo;{query}&rdquo;
        </p>
      )}
    </div>
  );
}
