import CropPickerSearch from "../scheduling/CropPickerSearch.tsx";
import { useCropDB } from "../../hooks/useCropDB.ts";
import type { CropSearchResult } from "../../services/cropDBSearch.ts";
import type { CropSource } from "../../validation/plantingSchedule.schema.ts";

export interface CropChoice {
  cropId: string;
  cropName: string;
  cropSource: CropSource;
}

interface StepSelectCropProps {
  onSelect: (choice: CropChoice) => void;
}

export default function StepSelectCrop({ onSelect }: StepSelectCropProps) {
  const { categories, getCropsForCategory, search } = useCropDB();

  function handleSearchSelect(result: CropSearchResult) {
    onSelect({
      cropId: result.cropId,
      cropName: result.cropName,
      cropSource: result.source,
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
        <CropPickerSearch onSelect={handleSearchSelect} onSearch={search} />
      </div>

      {/* Category browse */}
      <div className="mt-4 space-y-2">
        {categories.map((cat) => {
          const crops = getCropsForCategory(cat);
          return (
            <details key={cat} className="group">
              <summary className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted">
                {cat}
                <span className="ml-1 text-xs text-text-muted">
                  ({crops.length})
                </span>
              </summary>
              <div className="ml-4 mt-1 space-y-1">
                {crops.map((crop) => (
                  <button
                    key={crop.id}
                    type="button"
                    onClick={() =>
                      onSelect({
                        cropId: crop.id,
                        cropName: crop.commonName,
                        cropSource: "builtin",
                      })
                    }
                    className="block w-full rounded px-3 py-1.5 text-left text-sm text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
                  >
                    {crop.commonName}
                  </button>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
