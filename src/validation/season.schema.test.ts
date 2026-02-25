import { describe, it, expect } from "vitest";
import { seasonSchema } from "./season.schema.ts";
import { validateEntity } from "./helpers.ts";

const validSeason = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  version: 1,
  createdAt: "2026-03-01T10:00:00Z",
  updatedAt: "2026-03-01T10:00:00Z",
  name: "2026 Growing Season",
  year: 2026,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  isActive: true,
};

describe("seasonSchema", () => {
  it("accepts valid season data", () => {
    const result = validateEntity(seasonSchema, validSeason);
    expect(result.success).toBe(true);
  });

  it("accepts valid season with deletedAt", () => {
    const result = validateEntity(seasonSchema, {
      ...validSeason,
      deletedAt: "2026-12-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required field (name)", () => {
    const { name: _, ...noName } = validSeason;
    const result = validateEntity(seasonSchema, noName);
    expect(result.success).toBe(false);
  });

  it("rejects empty string for name", () => {
    const result = validateEntity(seasonSchema, {
      ...validSeason,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer year", () => {
    const result = validateEntity(seasonSchema, {
      ...validSeason,
      year: 2026.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative year", () => {
    const result = validateEntity(seasonSchema, {
      ...validSeason,
      year: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects datetime for startDate (expects date only)", () => {
    const result = validateEntity(seasonSchema, {
      ...validSeason,
      startDate: "2026-01-01T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects datetime for endDate (expects date only)", () => {
    const result = validateEntity(seasonSchema, {
      ...validSeason,
      endDate: "2026-12-31T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean isActive", () => {
    const result = validateEntity(seasonSchema, {
      ...validSeason,
      isActive: "yes",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown properties (strict mode)", () => {
    const result = validateEntity(seasonSchema, {
      ...validSeason,
      favorite: true,
    });
    expect(result.success).toBe(false);
  });

  it("returns typed data on success", () => {
    const result = validateEntity(seasonSchema, validSeason);
    if (result.success) {
      expect(result.data.name).toBe("2026 Growing Season");
      expect(result.data.year).toBe(2026);
    }
  });
});
