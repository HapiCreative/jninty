import MiniSearch from "minisearch";
import { loadCropDB } from "../data/cropdb/index.ts";
import type { CustomCrop } from "../validation/customCrop.schema.ts";

export interface CropSearchResult {
  id: string;
  cropId: string;
  cropName: string;
  varietyName: string;
  category: string;
  source: "builtin" | "custom";
}

interface CropSearchDoc {
  id: string;
  cropId: string;
  cropName: string;
  varietyName: string;
  category: string;
  source: "builtin" | "custom";
}

let searchIndex: MiniSearch<CropSearchDoc> | null = null;

/**
 * Build the MiniSearch index over all built-in + custom crop varieties.
 * Call once at app startup, and again when custom crops change.
 */
export function buildCropSearchIndex(
  customCrops: CustomCrop[],
): MiniSearch<CropSearchDoc> {
  const index = new MiniSearch<CropSearchDoc>({
    fields: ["cropName", "varietyName", "category"],
    storeFields: [
      "cropId",
      "cropName",
      "varietyName",
      "category",
      "source",
    ],
    searchOptions: {
      boost: { cropName: 2, varietyName: 1.5 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  const docs: CropSearchDoc[] = [];

  // Index built-in crops
  const builtIn = loadCropDB();
  for (const crop of builtIn) {
    for (const variety of crop.varieties) {
      docs.push({
        id: variety.id,
        cropId: crop.id,
        cropName: crop.commonName,
        varietyName: variety.name,
        category: crop.category,
        source: "builtin",
      });
    }
  }

  // Index custom crops
  for (const crop of customCrops) {
    for (const variety of crop.varieties) {
      docs.push({
        id: variety.id,
        cropId: crop.id,
        cropName: crop.commonName,
        varietyName: variety.name,
        category: crop.category,
        source: "custom",
      });
    }
  }

  index.addAll(docs);
  searchIndex = index;
  return index;
}

/**
 * Search the CropDB index. Returns matching variety entries.
 */
export function searchCrops(query: string): CropSearchResult[] {
  if (!searchIndex) return [];
  if (!query.trim()) return [];
  return searchIndex.search(query) as unknown as CropSearchResult[];
}

/**
 * Clear the search index (useful for testing or reinitialization).
 */
export function clearCropSearchIndex(): void {
  searchIndex = null;
}
