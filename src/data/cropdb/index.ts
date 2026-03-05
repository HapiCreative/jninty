import vegetablesData from "./vegetables.json";
import herbsData from "./herbs.json";
import flowersData from "./flowers.json";
import fruitsData from "./fruits.json";
import type { CropRecord, CropVariety } from "./cropdb.types.ts";

let cache: CropRecord[] | null = null;

/**
 * Loads all crop records from bundled JSON files.
 * Results are cached after the first call.
 */
export function loadCropDB(): CropRecord[] {
  if (cache) return cache;
  cache = [
    ...(vegetablesData as CropRecord[]),
    ...(herbsData as CropRecord[]),
    ...(flowersData as CropRecord[]),
    ...(fruitsData as CropRecord[]),
  ];
  return cache;
}

/**
 * Clears the cached CropDB data (useful for testing).
 */
export function clearCropDBCache(): void {
  cache = null;
}

/**
 * Find a crop record by its ID.
 */
export function getCropById(id: string): CropRecord | undefined {
  return loadCropDB().find((c) => c.id === id);
}

/**
 * Find a specific variety within a crop.
 */
export function getVarietyById(
  cropId: string,
  varietyId: string,
): CropVariety | undefined {
  const crop = getCropById(cropId);
  if (!crop) return undefined;
  return crop.varieties.find((v) => v.id === varietyId);
}

/**
 * Get all unique categories from the CropDB.
 */
export function getCategories(): string[] {
  const crops = loadCropDB();
  const categories = new Set<string>();
  for (const crop of crops) {
    categories.add(crop.category);
  }
  return [...categories].sort();
}

/**
 * Get all crops in a specific category.
 */
export function getCropsByCategory(category: string): CropRecord[] {
  return loadCropDB().filter((c) => c.category === category);
}
