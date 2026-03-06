import { describe, it, expect } from "vitest";
import { plantKnowledgeSchema } from "./plantKnowledge.schema.ts";
import { validateEntity } from "./helpers.ts";
import { z } from "zod";

import vegetablesData from "../../data/plants/vegetables.json";
import herbsData from "../../data/plants/herbs.json";
import fruitsData from "../../data/plants/fruits.json";
import flowersData from "../../data/plants/flowers.json";

const plantKnowledgeArraySchema = z.array(plantKnowledgeSchema);

const validPlant = {
  species: "Solanum lycopersicum",
  variety: "Cherry",
  commonName: "Cherry Tomato",
  plantType: "vegetable" as const,
  isPerennial: false,
  cropGroup: "tomato",
  indoorStartWeeksBeforeLastFrost: 6,
  transplantWeeksAfterLastFrost: 2,
  daysToGermination: 7,
  daysToMaturity: 65,
  spacingInches: 24,
  sunNeeds: "full_sun" as const,
  waterNeeds: "high" as const,
  soilPreference: "Well-drained, rich loam",
  matureHeightInches: 60,
  matureSpreadInches: 24,
  growthRate: "fast" as const,
  goodCompanions: ["basil", "carrot"],
  badCompanions: ["fennel"],
  commonPests: ["aphids", "hornworms"],
  commonDiseases: ["blight"],
};

describe("plantKnowledgeSchema", () => {
  it("accepts valid plant knowledge data", () => {
    const result = validateEntity(plantKnowledgeSchema, validPlant);
    expect(result.success).toBe(true);
  });

  it("accepts minimal required fields only", () => {
    const minimal = {
      species: "Solanum lycopersicum",
      commonName: "Tomato",
      plantType: "vegetable",
      isPerennial: false,
      cropGroup: "tomato",
      sunNeeds: "full_sun",
      waterNeeds: "high",
    };
    const result = validateEntity(plantKnowledgeSchema, minimal);
    expect(result.success).toBe(true);
  });

  it("rejects missing species", () => {
    const { species: _species, ...noSpecies } = validPlant;
    void _species;
    const result = validateEntity(plantKnowledgeSchema, noSpecies);
    expect(result.success).toBe(false);
  });

  it("rejects empty species", () => {
    const result = validateEntity(
      plantKnowledgeSchema,
      { ...validPlant, species: "" },
    );
    expect(result.success).toBe(false);
  });

  it("rejects missing commonName", () => {
    const { commonName: _commonName, ...noName } = validPlant;
    void _commonName;
    const result = validateEntity(plantKnowledgeSchema, noName);
    expect(result.success).toBe(false);
  });

  it("rejects invalid plantType", () => {
    const result = validateEntity(
      plantKnowledgeSchema,
      { ...validPlant, plantType: "shrub" },
    );
    expect(result.success).toBe(false);
  });

  it("rejects invalid sunNeeds", () => {
    const result = validateEntity(
      plantKnowledgeSchema,
      { ...validPlant, sunNeeds: "indirect" },
    );
    expect(result.success).toBe(false);
  });

  it("rejects invalid waterNeeds", () => {
    const result = validateEntity(
      plantKnowledgeSchema,
      { ...validPlant, waterNeeds: "very_high" },
    );
    expect(result.success).toBe(false);
  });

  it("rejects invalid growthRate", () => {
    const result = validateEntity(
      plantKnowledgeSchema,
      { ...validPlant, growthRate: "very_fast" },
    );
    expect(result.success).toBe(false);
  });

  it("rejects non-integer daysToGermination", () => {
    const result = validateEntity(
      plantKnowledgeSchema,
      { ...validPlant, daysToGermination: 7.5 },
    );
    expect(result.success).toBe(false);
  });

  it("rejects zero daysToGermination", () => {
    const result = validateEntity(
      plantKnowledgeSchema,
      { ...validPlant, daysToGermination: 0 },
    );
    expect(result.success).toBe(false);
  });

  it("rejects negative daysToMaturity", () => {
    const result = validateEntity(
      plantKnowledgeSchema,
      { ...validPlant, daysToMaturity: -10 },
    );
    expect(result.success).toBe(false);
  });

  it("rejects zero spacingInches", () => {
    const result = validateEntity(
      plantKnowledgeSchema,
      { ...validPlant, spacingInches: 0 },
    );
    expect(result.success).toBe(false);
  });

  it("accepts negative transplantWeeksAfterLastFrost", () => {
    const result = validateEntity(
      plantKnowledgeSchema,
      { ...validPlant, transplantWeeksAfterLastFrost: -4 },
    );
    expect(result.success).toBe(true);
  });

  it("rejects empty strings in goodCompanions", () => {
    const result = validateEntity(
      plantKnowledgeSchema,
      { ...validPlant, goodCompanions: ["basil", ""] },
    );
    expect(result.success).toBe(false);
  });

  it("rejects empty strings in commonPests", () => {
    const result = validateEntity(
      plantKnowledgeSchema,
      { ...validPlant, commonPests: [""] },
    );
    expect(result.success).toBe(false);
  });

  it("rejects unknown properties (strict mode)", () => {
    const result = validateEntity(
      plantKnowledgeSchema,
      { ...validPlant, favoriteColor: "green" },
    );
    expect(result.success).toBe(false);
  });

  it("returns typed data on success", () => {
    const result = validateEntity(plantKnowledgeSchema, validPlant);
    if (result.success) {
      expect(result.data.species).toBe("Solanum lycopersicum");
      expect(result.data.variety).toBe("Cherry");
      expect(result.data.goodCompanions).toEqual(["basil", "carrot"]);
    }
  });
});

// ─── JSON file validation tests ───

describe("vegetables.json", () => {
  it("passes Zod schema validation", () => {
    const result = plantKnowledgeArraySchema.safeParse(vegetablesData);
    if (!result.success) {
      const issues = result.error.issues.map(
        (i) => `[${i.path.join(".")}] ${i.message}`,
      );
      expect.fail(`Validation errors:\n${issues.join("\n")}`);
    }
    expect(result.success).toBe(true);
  });

  it("contains at least 30 entries", () => {
    expect((vegetablesData as unknown[]).length).toBeGreaterThanOrEqual(30);
  });

  it("all entries have plantType vegetable", () => {
    const result = plantKnowledgeArraySchema.parse(vegetablesData);
    for (const plant of result) {
      expect(plant.plantType).toBe("vegetable");
    }
  });

  it("has no duplicate species+variety combinations", () => {
    const result = plantKnowledgeArraySchema.parse(vegetablesData);
    const keys = result.map((p) => `${p.species}::${p.variety ?? ""}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("herbs.json", () => {
  it("passes Zod schema validation", () => {
    const result = plantKnowledgeArraySchema.safeParse(herbsData);
    if (!result.success) {
      const issues = result.error.issues.map(
        (i) => `[${i.path.join(".")}] ${i.message}`,
      );
      expect.fail(`Validation errors:\n${issues.join("\n")}`);
    }
    expect(result.success).toBe(true);
  });

  it("contains at least 15 entries", () => {
    expect((herbsData as unknown[]).length).toBeGreaterThanOrEqual(15);
  });

  it("all entries have plantType herb", () => {
    const result = plantKnowledgeArraySchema.parse(herbsData);
    for (const plant of result) {
      expect(plant.plantType).toBe("herb");
    }
  });

  it("has no duplicate species+variety combinations", () => {
    const result = plantKnowledgeArraySchema.parse(herbsData);
    const keys = result.map((p) => `${p.species}::${p.variety ?? ""}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("fruits.json", () => {
  it("passes Zod schema validation", () => {
    const result = plantKnowledgeArraySchema.safeParse(fruitsData);
    if (!result.success) {
      const issues = result.error.issues.map(
        (i) => `[${i.path.join(".")}] ${i.message}`,
      );
      expect.fail(`Validation errors:\n${issues.join("\n")}`);
    }
    expect(result.success).toBe(true);
  });

  it("contains at least 10 entries", () => {
    expect((fruitsData as unknown[]).length).toBeGreaterThanOrEqual(10);
  });

  it("all entries are perennial", () => {
    const result = plantKnowledgeArraySchema.parse(fruitsData);
    for (const plant of result) {
      expect(plant.isPerennial).toBe(true);
    }
  });

  it("has no duplicate species+variety combinations", () => {
    const result = plantKnowledgeArraySchema.parse(fruitsData);
    const keys = result.map((p) => `${p.species}::${p.variety ?? ""}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("flowers.json", () => {
  it("passes Zod schema validation", () => {
    const result = plantKnowledgeArraySchema.safeParse(flowersData);
    if (!result.success) {
      const issues = result.error.issues.map(
        (i) => `[${i.path.join(".")}] ${i.message}`,
      );
      expect.fail(`Validation errors:\n${issues.join("\n")}`);
    }
    expect(result.success).toBe(true);
  });

  it("contains at least 14 entries", () => {
    expect((flowersData as unknown[]).length).toBeGreaterThanOrEqual(14);
  });

  it("all entries have plantType flower", () => {
    const result = plantKnowledgeArraySchema.parse(flowersData);
    for (const plant of result) {
      expect(plant.plantType).toBe("flower");
    }
  });

  it("has no duplicate species+variety combinations", () => {
    const result = plantKnowledgeArraySchema.parse(flowersData);
    const keys = result.map((p) => `${p.species}::${p.variety ?? ""}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ─── Cross-file validation ───

describe("all plant data combined", () => {
  it("has no duplicate species+variety combinations across files", () => {
    const all = [
      ...plantKnowledgeArraySchema.parse(vegetablesData),
      ...plantKnowledgeArraySchema.parse(herbsData),
      ...plantKnowledgeArraySchema.parse(fruitsData),
      ...plantKnowledgeArraySchema.parse(flowersData),
    ];
    const keys = all.map((p) => `${p.species}::${p.variety ?? ""}`);
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const key of keys) {
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  it("has no entries with overlapping goodCompanions and badCompanions", () => {
    const all = [
      ...plantKnowledgeArraySchema.parse(vegetablesData),
      ...plantKnowledgeArraySchema.parse(herbsData),
      ...plantKnowledgeArraySchema.parse(fruitsData),
      ...plantKnowledgeArraySchema.parse(flowersData),
    ];
    const overlaps: string[] = [];
    for (const plant of all) {
      const good = new Set(plant.goodCompanions ?? []);
      for (const bad of plant.badCompanions ?? []) {
        if (good.has(bad)) {
          overlaps.push(`${plant.commonName}: "${bad}" in both good and bad`);
        }
      }
    }
    expect(overlaps).toEqual([]);
  });
});
