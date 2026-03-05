import { describe, it, expect, beforeEach } from "vitest";
import {
  buildCropSearchIndex,
  searchCrops,
  clearCropSearchIndex,
} from "./cropDBSearch.ts";

describe("cropDBSearch", () => {
  beforeEach(() => {
    clearCropSearchIndex();
    buildCropSearchIndex([]);
  });

  it("finds crops by common name", () => {
    const results = searchCrops("tomato");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.cropName).toBe("Tomato");
  });

  it("finds crops by variety name", () => {
    const results = searchCrops("cherry");
    expect(results.length).toBeGreaterThan(0);
    // Cherry Tomato should be in results
    const hasCherryTomato = results.some(
      (r) => r.cropName === "Tomato" && r.varietyName === "Cherry",
    );
    expect(hasCherryTomato).toBe(true);
  });

  it("returns empty array for no match", () => {
    const results = searchCrops("xyznonexistent");
    expect(results).toEqual([]);
  });

  it("returns empty array for empty query", () => {
    expect(searchCrops("")).toEqual([]);
    expect(searchCrops("  ")).toEqual([]);
  });

  it("supports fuzzy matching", () => {
    const results = searchCrops("tomto"); // typo
    expect(results.length).toBeGreaterThan(0);
  });

  it("supports prefix matching", () => {
    const results = searchCrops("tom");
    expect(results.length).toBeGreaterThan(0);
  });

  it("all results have required fields", () => {
    const results = searchCrops("basil");
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.id).toBeDefined();
      expect(result.cropId).toBeDefined();
      expect(result.cropName).toBeDefined();
      expect(result.varietyName).toBeDefined();
      expect(result.source).toBe("builtin");
    }
  });

  it("includes custom crops when provided", () => {
    clearCropSearchIndex();
    buildCropSearchIndex([
      {
        id: "custom-1",
        category: "Custom",
        commonName: "Dragon Fruit",
        varieties: [
          {
            id: "df-red",
            name: "Red",
            daysToMaturity: 180,
            daysToTransplant: null,
            seedingDepthInches: 0.5,
            spacingInches: 72,
            rowSpacingInches: 96,
            harvestWindowDays: 60,
            bedPrepLeadDays: 14,
            successionIntervalDays: null,
            directSow: false,
            indoorStart: false,
            frostHardy: false,
          },
        ],
        version: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const results = searchCrops("dragon");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.cropName).toBe("Dragon Fruit");
    expect(results[0]!.source).toBe("custom");
  });

  it("returns empty when index not built", () => {
    clearCropSearchIndex();
    expect(searchCrops("tomato")).toEqual([]);
  });
});
