import { useMemo, useCallback } from "react";
import { loadCropDB, getCategories, getCropsByCategory } from "../data/cropdb/index.ts";
import { searchCrops, type CropSearchResult } from "../services/cropDBSearch.ts";
import { usePouchQuery } from "./usePouchQuery.ts";
import { customCropRepository } from "../db/index.ts";
import type { CropRecord } from "../data/cropdb/cropdb.types.ts";

export function useCropDB() {
  const customCrops = usePouchQuery(() => customCropRepository.getAll());

  const allCrops = useMemo((): CropRecord[] => {
    const builtIn = loadCropDB();
    if (!customCrops || customCrops.length === 0) return builtIn;

    // Merge custom crops (cast to CropRecord shape) after built-in
    const custom: CropRecord[] = customCrops.map((c) => ({
      id: c.id,
      category: c.category,
      commonName: c.commonName,
      varieties: c.varieties.map((v) => ({
        ...v,
        notes: v.notes ?? "",
      })),
    }));

    return [...builtIn, ...custom];
  }, [customCrops]);

  const categories = useMemo(() => getCategories(), []);

  const getCropsForCategory = useCallback(
    (category: string): CropRecord[] => getCropsByCategory(category),
    [],
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
