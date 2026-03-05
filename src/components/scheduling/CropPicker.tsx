import { useState, useCallback } from "react";
import CropPickerSearch from "./CropPickerSearch.tsx";
import VarietySelector from "./VarietySelector.tsx";
import { useCropDB } from "../../hooks/useCropDB.ts";
import type { CropSearchResult } from "../../services/cropDBSearch.ts";
import type { CropVariety } from "../../data/cropdb/cropdb.types.ts";
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

export default function CropPicker({ onSelect, onClose }: CropPickerProps) {
  const { categories, getCropsForCategory, search } = useCropDB();
  const [step, setStep] = useState<PickerStep>("search");
  const [selectedCrop, setSelectedCrop] = useState<{
    cropId: string;
    cropName: string;
    cropSource: CropSource;
  } | null>(null);

  const handleSearchSelect = useCallback((result: CropSearchResult) => {
    // If they picked a specific variety from search, select it directly
    onSelect({
      cropId: result.cropId,
      varietyId: result.id,
      cropName: result.cropName,
      varietyName: result.varietyName,
      cropSource: result.source,
    });
  }, [onSelect]);

  const handleCropClick = useCallback(
    (cropId: string, cropName: string, source: CropSource) => {
      setSelectedCrop({ cropId, cropName, cropSource: source });
      setStep("varieties");
    },
    [],
  );

  const handleVarietySelect = useCallback(
    (variety: CropVariety) => {
      if (!selectedCrop) return;
      onSelect({
        cropId: selectedCrop.cropId,
        varietyId: variety.id,
        cropName: selectedCrop.cropName,
        varietyName: variety.name,
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
              onSearch={search}
              onSelect={handleSearchSelect}
            />

            {/* Category browse */}
            <div className="mt-4">
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                Browse by Category
              </h3>
              <div className="mt-2 space-y-1">
                {categories.map((category) => {
                  const crops = getCropsForCategory(category);
                  return (
                    <details key={category} className="group">
                      <summary className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-text-heading transition-colors hover:bg-surface-muted">
                        <span>{category}</span>
                        <span className="text-xs text-text-muted">
                          {crops.length}
                        </span>
                      </summary>
                      <ul className="mt-1 space-y-0.5 pl-3">
                        {crops.map((crop) => (
                          <li key={crop.id}>
                            <button
                              type="button"
                              onClick={() =>
                                handleCropClick(
                                  crop.id,
                                  crop.commonName,
                                  "builtin",
                                )
                              }
                              className="flex w-full items-baseline justify-between rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-muted"
                            >
                              <span className="text-text-heading">
                                {crop.commonName}
                              </span>
                              <span className="text-xs text-text-muted">
                                {crop.varieties.length} var.
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
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
