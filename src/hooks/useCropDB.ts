import { useMemo, useCallback, useEffect } from "react";
import { loadCropDB } from "../data/cropdb/index.ts";
import { searchCrops, buildCropSearchIndex, type CropSearchResult } from "../services/cropDBSearch.ts";
import { usePouchQuery } from "./usePouchQuery.ts";
import { customCropRepository } from "../db/index.ts";
import type { CropRecord } from "../data/cropdb/cropdb.types.ts";

/** Fixed display order for crop categories (most common first). */
const CATEGORY_ORDER = ["Vegetable", "Herb", "Flower", "Fruit"] as const;

export function useCropDB() {
  const customCrops = usePouchQuery(() => customCropRepository.getAll());

  const allCrops = useMemo((): CropRecord[] => {
    const builtIn = loadCropDB();
    if (!customCrops || customCrops.length === 0) return builtIn;

    // Merge custom crops (cast to CropRecord shape) after built-in
    const custom: CropRecord[] = customCrops.map((c) => ({
      id: c.id,
      category: c.category,
      family: c.family ?? "",
      commonName: c.commonName,
      varieties: c.varieties.map((v) => ({
        ...v,
        notes: v.notes ?? "",
      })),
    }));

    return [...builtIn, ...custom];
  }, [customCrops]);

  // Rebuild crop search index when custom crops change
  useEffect(() => {
    buildCropSearchIndex(customCrops ?? []);
  }, [customCrops]);

  const categories = useMemo(() => {
    // Use fixed display order, plus any extra categories from custom crops
    const allCats = new Set(allCrops.map((c) => c.category));
    const ordered: string[] = [];
    for (const cat of CATEGORY_ORDER) {
      if (allCats.has(cat)) {
        ordered.push(cat);
        allCats.delete(cat);
      }
    }
    // Append any custom categories not in the fixed order
    for (const cat of [...allCats].sort()) {
      ordered.push(cat);
    }
    return ordered;
  }, [allCrops]);

  const getCropsForCategory = useCallback(
    (category: string): CropRecord[] =>
      allCrops
        .filter((c) => c.category === category)
        .sort((a, b) => a.commonName.localeCompare(b.commonName)),
    [allCrops],
  );

  const search = useCallback(
    (query: string): CropSearchResult[] => searchCrops(query),
    [],
  );

  return {
    allCrops,
    customCrops,
    categories,
    getCropsForCategory,
    search,
    loading: customCrops === undefined,
  };
}
