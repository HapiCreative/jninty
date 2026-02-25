import { describe, it, expect } from "vitest";
import { plantInstanceSchema } from "./plantInstance.schema.ts";
import { validateEntity } from "./helpers.ts";

const validPlant = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  version: 1,
  createdAt: "2026-03-01T10:00:00Z",
  updatedAt: "2026-03-01T10:00:00Z",
  species: "Solanum lycopersicum",
  variety: "San Marzano",
  type: "vegetable" as const,
  isPerennial: false,
  source: "seed" as const,
  status: "active" as const,
  tags: ["tomato", "sauce"],
};

describe("plantInstanceSchema", () => {
  it("accepts valid plant data", () => {
    const result = validateEntity(plantInstanceSchema, validPlant);
    expect(result.success).toBe(true);
  });

  it("accepts valid plant with all optional fields", () => {
    const full = {
      ...validPlant,
      nickname: "Big Red",
      dateAcquired: "2026-02-15",
      seedId: "660e8400-e29b-41d4-a716-446655440001",
      careNotes: "Needs extra calcium",
      deletedAt: "2026-12-01T00:00:00Z",
    };
    const result = validateEntity(plantInstanceSchema, full);
    expect(result.success).toBe(true);
  });

  it("accepts empty tags array", () => {
    const result = validateEntity(plantInstanceSchema, {
      ...validPlant,
      tags: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required field (species)", () => {
    const { species: _, ...noSpecies } = validPlant;
    const result = validateEntity(plantInstanceSchema, noSpecies);
    expect(result.success).toBe(false);
  });

  it("rejects empty string for species", () => {
    const result = validateEntity(plantInstanceSchema, {
      ...validPlant,
      species: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid plant type", () => {
    const result = validateEntity(plantInstanceSchema, {
      ...validPlant,
      type: "cactus",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid source", () => {
    const result = validateEntity(plantInstanceSchema, {
      ...validPlant,
      source: "stolen",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = validateEntity(plantInstanceSchema, {
      ...validPlant,
      status: "thriving",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean isPerennial", () => {
    const result = validateEntity(plantInstanceSchema, {
      ...validPlant,
      isPerennial: "yes",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative version", () => {
    const result = validateEntity(plantInstanceSchema, {
      ...validPlant,
      version: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID for id", () => {
    const result = validateEntity(plantInstanceSchema, {
      ...validPlant,
      id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid ISO timestamp for createdAt", () => {
    const result = validateEntity(plantInstanceSchema, {
      ...validPlant,
      createdAt: "March 1 2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty string in tags array", () => {
    const result = validateEntity(plantInstanceSchema, {
      ...validPlant,
      tags: ["tomato", ""],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty string for nickname", () => {
    const result = validateEntity(plantInstanceSchema, {
      ...validPlant,
      nickname: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid seedId (not UUID)", () => {
    const result = validateEntity(plantInstanceSchema, {
      ...validPlant,
      seedId: "abc123",
    });
    expect(result.success).toBe(false);
  });

  it("returns typed data on success", () => {
    const result = validateEntity(plantInstanceSchema, validPlant);
    if (result.success) {
      expect(result.data.species).toBe("Solanum lycopersicum");
      expect(result.data.tags).toEqual(["tomato", "sauce"]);
    }
  });

  it("returns ZodError on failure with issue details", () => {
    const result = validateEntity(plantInstanceSchema, {});
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("rejects unknown properties (strict mode)", () => {
    const result = validateEntity(plantInstanceSchema, {
      ...validPlant,
      favoriteColor: "blue",
    });
    expect(result.success).toBe(false);
  });

  it("rejects datetime for dateAcquired (expects date only)", () => {
    const result = validateEntity(plantInstanceSchema, {
      ...validPlant,
      dateAcquired: "2026-02-15T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});
