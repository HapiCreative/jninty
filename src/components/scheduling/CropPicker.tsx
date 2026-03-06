import { useState, useCallback, useMemo } from "react";
import CropPickerSearch from "./CropPickerSearch.tsx";
import VarietySelector from "./VarietySelector.tsx";
import {
  getSchedulable,
  searchSchedulable,
  builtInEntryId,
} from "../../services/knowledgeBase.ts";
import type { SchedulableSearchResult } from "../../services/knowledgeBase.ts";
import type { PlantKnowledge } from "../../validation/plantKnowledge.schema.ts";
import type { CropSource } from "../../validation/plantingSchedule.schema.ts";

export interface CropSelection {
  cropId: string;
  varietyId: string;
  cropName: string;
  varietyName: string;
  cropSource: CropSource;
}

interface CropPickerProps {
  onSelect: (selection: CropSelection) => void;
  onClose: () => void;
}

type PickerStep = "search" | "varieties";

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

export default function CropPicker({ onSelect, onClose }: CropPickerProps) {
  const [step, setStep] = useState<PickerStep>("search");
  const [selectedCrop, setSelectedCrop] = useState<{
    cropId: string;
    cropName: string;
    cropSource: CropSource;
  } | null>(null);

  // Group schedulable entries by category → cropGroup
  const categoryGroups = useMemo(() => {
    const entries = getSchedulable();
    const categories = new Map<
      string,
      Map<string, { name: string; count: number }>
    >();

    for (const entry of entries) {
      const cat = entry.plantType;
      if (!categories.has(cat)) {
        categories.set(cat, new Map());
      }
      const groups = categories.get(cat)!;
      const existing = groups.get(entry.cropGroup);
      if (existing) {
        existing.count++;
      } else {
        // Use the base commonName (without variety) as the crop display name
        const displayName = entry.variety
          ? entry.commonName.replace(new RegExp(`^${entry.variety}\\s+`), "")
          : entry.commonName;
        groups.set(entry.cropGroup, { name: displayName, count: 1 });
      }
    }

    return categories;
  }, []);

  const handleSearchSelect = useCallback(
    (result: SchedulableSearchResult) => {
      onSelect({
        cropId: result.cropGroup,
        varietyId: result.id,
        cropName: result.commonName,
        varietyName: result.variety || result.commonName,
        cropSource: "builtin",
      });
    },
    [onSelect],
  );

  const handleCropClick = useCallback(
    (cropId: string, cropName: string, source: CropSource) => {
      setSelectedCrop({ cropId, cropName, cropSource: source });
      setStep("varieties");
    },
    [],
  );

  const handleVarietySelect = useCallback(
    (entry: PlantKnowledge) => {
      if (!selectedCrop) return;
      onSelect({
        cropId: selectedCrop.cropId,
        varietyId: builtInEntryId(entry.species, entry.variety),
        cropName: selectedCrop.cropName,
        varietyName: entry.variety ?? entry.commonName,
        cropSource: selectedCrop.cropSource,
      });
    },
    [selectedCrop, onSelect],
  );

  const handleBack = useCallback(() => {
    setStep("search");
    setSelectedCrop(null);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <h2 className="font-display text-base font-semibold text-text-heading">
          Select Crop
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-heading"
          aria-label="Close crop picker"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {step === "search" && (
          <>
            <CropPickerSearch
              onSearch={searchSchedulable}
              onSelect={handleSearchSelect}
            />

            {/* Category browse */}
            <div className="mt-4">
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                Browse by Category
              </h3>
              <div className="mt-2 space-y-1">
                {[...categoryGroups.entries()].map(([category, groups]) => (
                  <details key={category} className="group">
                    <summary className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-text-heading transition-colors hover:bg-surface-muted">
                      <span>{CATEGORY_LABELS[category] ?? category}</span>
                      <span className="text-xs text-text-muted">
                        {groups.size}
                      </span>
                    </summary>
                    <ul className="mt-1 space-y-0.5 pl-3">
                      {[...groups.entries()]
                        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
                        .map(([groupId, { name, count }]) => (
                          <li key={groupId}>
                            <button
                              type="button"
                              onClick={() =>
                                handleCropClick(groupId, name, "builtin")
                              }
                              className="flex w-full items-baseline justify-between rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-muted"
                            >
                              <span className="text-text-heading">
                                {name}
                              </span>
                              <span className="text-xs text-text-muted">
                                {count} var.
                              </span>
                            </button>
                          </li>
                        ))}
                    </ul>
                  </details>
                ))}
              </div>
            </div>
          </>
        )}

        {step === "varieties" && selectedCrop && (
          <VarietySelector
            cropId={selectedCrop.cropId}
            cropName={selectedCrop.cropName}
            onSelect={handleVarietySelect}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}
