import { describe, it, expect } from "vitest";
import {
  PLANT_CATEGORIES,
  ALL_KNOWLEDGE_SECTIONS,
  getCategoryBySlug,
} from "./knowledgeCategories.ts";

describe("knowledgeCategories", () => {
  it("defines 4 plant categories", () => {
    expect(PLANT_CATEGORIES).toHaveLength(4);
  });

  it("each category has required fields", () => {
    for (const cat of PLANT_CATEGORIES) {
      expect(cat.slug).toBeTruthy();
      expect(cat.label).toBeTruthy();
      expect(cat.description).toBeTruthy();
      expect(cat.plantTypes.length).toBeGreaterThan(0);
    }
  });

  it("ALL_KNOWLEDGE_SECTIONS includes a plants section", () => {
    const plants = ALL_KNOWLEDGE_SECTIONS.find((s) => s.slug === "plants");
    expect(plants).toBeDefined();
    expect(plants?.label).toBe("Plants");
  });

  it("getCategoryBySlug finds vegetables", () => {
    const cat = getCategoryBySlug("vegetables");
    expect(cat).toBeDefined();
    expect(cat?.label).toBe("Vegetables");
  });

  it("getCategoryBySlug returns undefined for unknown slug", () => {
    expect(getCategoryBySlug("unknown")).toBeUndefined();
  });
});
