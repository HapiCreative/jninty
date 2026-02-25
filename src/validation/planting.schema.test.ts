import { describe, it, expect } from "vitest";
import { plantingSchema } from "./planting.schema.ts";
import { validateEntity } from "./helpers.ts";

const validPlanting = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  version: 1,
  createdAt: "2026-03-01T10:00:00Z",
  updatedAt: "2026-03-01T10:00:00Z",
  plantInstanceId: "660e8400-e29b-41d4-a716-446655440001",
  seasonId: "770e8400-e29b-41d4-a716-446655440002",
};

describe("plantingSchema", () => {
  it("accepts valid minimal planting data", () => {
    const result = validateEntity(plantingSchema, validPlanting);
    expect(result.success).toBe(true);
  });

  it("accepts valid planting with all optional fields", () => {
    const full = {
      ...validPlanting,
      bedId: "880e8400-e29b-41d4-a716-446655440003",
      datePlanted: "2026-04-15",
      dateRemoved: "2026-10-01",
      outcome: "thrived" as const,
      notes: "Great yield this year",
      deletedAt: "2026-12-01T00:00:00Z",
    };
    const result = validateEntity(plantingSchema, full);
    expect(result.success).toBe(true);
  });

  it("rejects missing plantInstanceId", () => {
    const { plantInstanceId: _, ...noPlantId } = validPlanting;
    const result = validateEntity(plantingSchema, noPlantId);
    expect(result.success).toBe(false);
  });

  it("rejects missing seasonId", () => {
    const { seasonId: _, ...noSeasonId } = validPlanting;
    const result = validateEntity(plantingSchema, noSeasonId);
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID plantInstanceId", () => {
    const result = validateEntity(plantingSchema, {
      ...validPlanting,
      plantInstanceId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID seasonId", () => {
    const result = validateEntity(plantingSchema, {
      ...validPlanting,
      seasonId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid outcome value", () => {
    const result = validateEntity(plantingSchema, {
      ...validPlanting,
      outcome: "amazing",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid outcome values", () => {
    for (const outcome of ["thrived", "ok", "failed", "unknown"]) {
      const result = validateEntity(plantingSchema, {
        ...validPlanting,
        outcome,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects datetime for datePlanted (expects date only)", () => {
    const result = validateEntity(plantingSchema, {
      ...validPlanting,
      datePlanted: "2026-04-15T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty string for notes", () => {
    const result = validateEntity(plantingSchema, {
      ...validPlanting,
      notes: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown properties (strict mode)", () => {
    const result = validateEntity(plantingSchema, {
      ...validPlanting,
      extra: "nope",
    });
    expect(result.success).toBe(false);
  });

  it("returns typed data on success", () => {
    const result = validateEntity(plantingSchema, validPlanting);
    if (result.success) {
      expect(result.data.plantInstanceId).toBe(validPlanting.plantInstanceId);
      expect(result.data.seasonId).toBe(validPlanting.seasonId);
    }
  });
});
