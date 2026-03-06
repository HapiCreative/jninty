import { describe, it, expect } from "vitest";
import { userPlantKnowledgeSchema } from "./userPlantKnowledge.schema.ts";
import { validateEntity } from "./helpers.ts";

const validEntry = {
  id: "00000000-0000-0000-0000-000000000001",
  version: 1,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  species: "Solanum lycopersicum",
  commonName: "Tomato",
  plantType: "vegetable" as const,
  isPerennial: false,
  cropGroup: "tomato",
  sunNeeds: "full_sun" as const,
  waterNeeds: "moderate" as const,
};

describe("userPlantKnowledgeSchema", () => {
  it("accepts valid entry with base fields + knowledge fields", () => {
    const result = validateEntity(userPlantKnowledgeSchema, validEntry);
    expect(result.success).toBe(true);
  });

  it("accepts entry with all optional knowledge fields", () => {
    const full = {
      ...validEntry,
      variety: "Roma",
      soilPreference: "Well-drained loam",
      growthRate: "fast" as const,
      spacingInches: 24,
      matureHeightInches: 48,
      matureSpreadInches: 24,
      indoorStartWeeksBeforeLastFrost: 6,
      transplantWeeksAfterLastFrost: 2,
      directSowWeeksBeforeLastFrost: 4,
      directSowWeeksAfterLastFrost: 1,
      daysToGermination: 7,
      daysToMaturity: 75,
      goodCompanions: ["Basil", "Carrots"],
      badCompanions: ["Fennel"],
      commonPests: ["Aphids"],
      commonDiseases: ["Blight"],
    };
    const result = validateEntity(userPlantKnowledgeSchema, full);
    expect(result.success).toBe(true);
  });

  it("accepts entry with deletedAt", () => {
    const result = validateEntity(userPlantKnowledgeSchema, {
      ...validEntry,
      deletedAt: "2025-06-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing base entity fields", () => {
    const { id: _id, ...noId } = validEntry;
    void _id;
    const result = validateEntity(userPlantKnowledgeSchema, noId);
    expect(result.success).toBe(false);
  });

  it("rejects missing knowledge fields", () => {
    const { species: _species, ...noSpecies } = validEntry;
    void _species;
    const result = validateEntity(userPlantKnowledgeSchema, noSpecies);
    expect(result.success).toBe(false);
  });

  it("rejects unknown properties (strict mode)", () => {
    const result = validateEntity(userPlantKnowledgeSchema, {
      ...validEntry,
      unknownField: "should fail",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid plantType", () => {
    const result = validateEntity(userPlantKnowledgeSchema, {
      ...validEntry,
      plantType: "tree",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid sunNeeds", () => {
    const result = validateEntity(userPlantKnowledgeSchema, {
      ...validEntry,
      sunNeeds: "indirect",
    });
    expect(result.success).toBe(false);
  });

  it("returns typed data on success", () => {
    const result = validateEntity(userPlantKnowledgeSchema, validEntry);
    if (result.success) {
      expect(result.data.id).toBe(validEntry.id);
      expect(result.data.species).toBe("Solanum lycopersicum");
      expect(result.data.version).toBe(1);
    }
  });
});
