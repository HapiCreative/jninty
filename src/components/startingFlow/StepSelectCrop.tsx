import CropPickerSearch from "../scheduling/CropPickerSearch.tsx";
import {
  getSchedulable,
  searchSchedulable,
} from "../../services/knowledgeBase.ts";
import type { SchedulableSearchResult } from "../../services/knowledgeBase.ts";
import type { CropSource } from "../../validation/plantingSchedule.schema.ts";
import { useMemo } from "react";

export interface CropChoice {
  cropId: string;
  cropName: string;
  cropSource: CropSource;
}

interface StepSelectCropProps {
  onSelect: (choice: CropChoice) => void;
}

/** Display-friendly category labels for plantType values. */
const CATEGORY_LABELS: Record<string, string> = {
  vegetable: "Vegetable",
  herb: "Herb",
  flower: "Flower",
  berry: "Berry",
  fruit_tree: "Fruit Tree",
  ornamental: "Ornamental",
  other: "Other",
};

export default function StepSelectCrop({ onSelect }: StepSelectCropProps) {
  // Group schedulable entries by category → cropGroup
  const categoryGroups = useMemo(() => {
    const entries = getSchedulable();
    const categories = new Map<
      string,
      Map<string, { name: string }>
    >();

    for (const entry of entries) {
      const cat = entry.plantType;
      if (!categories.has(cat)) {
        categories.set(cat, new Map());
      }
      const groups = categories.get(cat)!;
      if (!groups.has(entry.cropGroup)) {
        const displayName = entry.variety
          ? entry.commonName.replace(new RegExp(`^${entry.variety}\\s+`), "")
          : entry.commonName;
        groups.set(entry.cropGroup, { name: displayName });
      }
    }

    return categories;
  }, []);

  function handleSearchSelect(result: SchedulableSearchResult) {
    onSelect({
      cropId: result.cropGroup,
      cropName: result.commonName,
      cropSource: "builtin",
    });
  }

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-text-heading">
        Select a Crop
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Search or browse by category.
      </p>

      <div className="mt-4">
        <CropPickerSearch onSelect={handleSearchSelect} onSearch={searchSchedulable} />
      </div>

      {/* Category browse */}
      <div className="mt-4 space-y-2">
        {[...categoryGroups.entries()].map(([cat, groups]) => (
          <details key={cat} className="group">
            <summary className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted">
              {CATEGORY_LABELS[cat] ?? cat}
              <span className="ml-1 text-xs text-text-muted">
                ({groups.size})
              </span>
            </summary>
            <div className="ml-4 mt-1 space-y-1">
              {[...groups.entries()]
                .sort(([, a], [, b]) => a.name.localeCompare(b.name))
                .map(([groupId, { name }]) => (
                  <button
                    key={groupId}
                    type="button"
                    onClick={() =>
                      onSelect({
                        cropId: groupId,
                        cropName: name,
                        cropSource: "builtin",
                      })
                    }
                    className="block w-full rounded px-3 py-1.5 text-left text-sm text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
                  >
                    {name}
                  </button>
                ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
