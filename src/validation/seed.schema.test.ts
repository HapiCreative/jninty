import { describe, it, expect } from "vitest";
import { seedSchema, quantityUnitSchema } from "./seed.schema.ts";

const validSeed = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  version: 1,
  createdAt: "2026-02-25T10:00:00.000Z",
  updatedAt: "2026-02-25T10:00:00.000Z",
  name: "San Marzano Tomato Seeds",
  species: "Solanum lycopersicum",
  quantityRemaining: 25,
  quantityUnit: "count" as const,
};

describe("seedSchema", () => {
  it("accepts a minimal valid seed", () => {
    const result = seedSchema.safeParse(validSeed);
    expect(result.success).toBe(true);
  });

  it("accepts a seed with all optional fields", () => {
    const result = seedSchema.safeParse({
      ...validSeed,
      variety: "San Marzano",
      brand: "Burpee",
      supplier: "Home Depot",
      purchaseDate: "2026-01-15",
      expiryDate: "2027-06-30",
      germinationRate: 85,
      cost: 3.99,
      storageLocation: "Fridge box A",
      notes: "Great for sauce",
    });
    expect(result.success).toBe(true);
  });

  it("accepts deletedAt when present", () => {
    const result = seedSchema.safeParse({
      ...validSeed,
      deletedAt: "2026-03-01T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name: _, ...noName } = validSeed;
    const result = seedSchema.safeParse(noName);
    expect(result.success).toBe(false);
  });

  it("rejects missing species", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { species: _, ...noSpecies } = validSeed;
    const result = seedSchema.safeParse(noSpecies);
    expect(result.success).toBe(false);
  });

  it("rejects negative quantity", () => {
    const result = seedSchema.safeParse({
      ...validSeed,
      quantityRemaining: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects germination rate above 100", () => {
    const result = seedSchema.safeParse({
      ...validSeed,
      germinationRate: 101,
    });
    expect(result.success).toBe(false);
  });

  it("rejects germination rate below 0", () => {
    const result = seedSchema.safeParse({
      ...validSeed,
      germinationRate: -5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer germination rate", () => {
    const result = seedSchema.safeParse({
      ...validSeed,
      germinationRate: 85.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects extra unknown fields (strict)", () => {
    const result = seedSchema.safeParse({
      ...validSeed,
      unknownField: "nope",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid quantity unit", () => {
    const result = seedSchema.safeParse({
      ...validSeed,
      quantityUnit: "kilograms",
    });
    expect(result.success).toBe(false);
  });
});

describe("quantityUnitSchema", () => {
  it.each(["packets", "grams", "ounces", "count"])("accepts %s", (unit) => {
    expect(quantityUnitSchema.safeParse(unit).success).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(quantityUnitSchema.safeParse("pounds").success).toBe(false);
  });
});
