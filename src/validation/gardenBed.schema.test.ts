import { describe, it, expect } from "vitest";
import { gardenBedSchema } from "./gardenBed.schema.ts";
import { validateEntity } from "./helpers.ts";

const validBed = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  version: 0,
  createdAt: "2026-03-01T10:00:00Z",
  updatedAt: "2026-03-01T10:00:00Z",
  name: "North Raised Bed",
  type: "vegetable_bed" as const,
  gridX: 0,
  gridY: 0,
  gridWidth: 4,
  gridHeight: 2,
  shape: "rectangle" as const,
  color: "#7dbf4e",
};

describe("gardenBedSchema", () => {
  it("accepts valid garden bed", () => {
    const result = validateEntity(gardenBedSchema, validBed);
    expect(result.success).toBe(true);
  });

  it("accepts all bed types", () => {
    const types = [
      "vegetable_bed",
      "flower_bed",
      "fruit_area",
      "herb_garden",
      "container",
      "other",
    ];
    for (const type of types) {
      const result = validateEntity(gardenBedSchema, {
        ...validBed,
        type,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts bed with deletedAt", () => {
    const result = validateEntity(gardenBedSchema, {
      ...validBed,
      deletedAt: "2026-06-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = validateEntity(gardenBedSchema, {
      ...validBed,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const { name: _, ...noName } = validBed;
    const result = validateEntity(gardenBedSchema, noName);
    expect(result.success).toBe(false);
  });

  it("rejects invalid bed type", () => {
    const result = validateEntity(gardenBedSchema, {
      ...validBed,
      type: "swimming_pool",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing type", () => {
    const { type: _, ...noType } = validBed;
    const result = validateEntity(gardenBedSchema, noType);
    expect(result.success).toBe(false);
  });

  it("rejects invalid id format", () => {
    const result = validateEntity(gardenBedSchema, {
      ...validBed,
      id: "123",
    });
    expect(result.success).toBe(false);
  });
});
