import { describe, it, expect, beforeEach } from "vitest";
import {
  loadCropDB,
  clearCropDBCache,
  getCropById,
  getVarietyById,
  getCategories,
  getCropsByCategory,
} from "./index.ts";

describe("CropDB Loader", () => {
  beforeEach(() => {
    clearCropDBCache();
  });

  describe("loadCropDB", () => {
    it("loads all crop records from JSON files", () => {
      const crops = loadCropDB();
      expect(crops.length).toBeGreaterThan(0);
      expect(crops[0]).toHaveProperty("id");
      expect(crops[0]).toHaveProperty("commonName");
      expect(crops[0]).toHaveProperty("varieties");
    });

    it("returns cached results on subsequent calls", () => {
      const first = loadCropDB();
      const second = loadCropDB();
      expect(first).toBe(second); // Same reference
    });

    it("includes crops from all four JSON files", () => {
      const crops = loadCropDB();
      const names = crops.map((c) => c.commonName);
      // Vegetables
      expect(names).toContain("Tomato");
      // Herbs
      expect(names).toContain("Basil");
      // Flowers
      expect(names).toContain("Sunflower");
      // Fruits
      expect(names).toContain("Strawberry");
    });

    it("every variety has required numeric fields", () => {
      const crops = loadCropDB();
      for (const crop of crops) {
        for (const v of crop.varieties) {
          expect(v.daysToMaturity).toBeGreaterThan(0);
          expect(v.seedingDepthInches).toBeGreaterThanOrEqual(0);
          expect(v.spacingInches).toBeGreaterThan(0);
          expect(v.harvestWindowDays).toBeGreaterThan(0);
          expect(typeof v.directSow).toBe("boolean");
          expect(typeof v.indoorStart).toBe("boolean");
          expect(typeof v.frostHardy).toBe("boolean");
        }
      }
    });
  });

  describe("getCropById", () => {
    it("finds a crop by ID", () => {
      const tomato = getCropById("tomato");
      expect(tomato).toBeDefined();
      expect(tomato!.commonName).toBe("Tomato");
    });

    it("returns undefined for unknown ID", () => {
      expect(getCropById("nonexistent")).toBeUndefined();
    });
  });

  describe("getVarietyById", () => {
    it("finds a variety within a crop", () => {
      const cherry = getVarietyById("tomato", "tomato-cherry");
      expect(cherry).toBeDefined();
      expect(cherry!.name).toBe("Cherry");
    });

    it("returns undefined for unknown crop ID", () => {
      expect(getVarietyById("nonexistent", "x")).toBeUndefined();
    });

    it("returns undefined for unknown variety ID", () => {
      expect(getVarietyById("tomato", "nonexistent")).toBeUndefined();
    });
  });

  describe("getCategories", () => {
    it("returns sorted unique categories", () => {
      const categories = getCategories();
      expect(categories.length).toBeGreaterThan(0);
      // Check sorted
      for (let i = 1; i < categories.length; i++) {
        expect(categories[i]! >= categories[i - 1]!).toBe(true);
      }
    });
  });

  describe("getCropsByCategory", () => {
    it("returns crops filtered by category", () => {
      const solanaceae = getCropsByCategory("Solanaceae");
      expect(solanaceae.length).toBeGreaterThan(0);
      for (const crop of solanaceae) {
        expect(crop.category).toBe("Solanaceae");
      }
    });

    it("returns empty array for unknown category", () => {
      expect(getCropsByCategory("Nonexistent")).toEqual([]);
    });
  });
});
