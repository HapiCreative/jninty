import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../schema.ts";
import * as seedRepo from "./seedRepository.ts";
import * as plantRepo from "./plantRepository.ts";
import * as plantingRepo from "./plantingRepository.ts";
import * as seasonRepo from "./seasonRepository.ts";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const baseSeed = {
  name: "San Marzano Tomato Seeds",
  species: "Solanum lycopersicum",
  variety: "San Marzano",
  quantityRemaining: 25,
  quantityUnit: "count" as const,
};

describe("plant from seed flow", () => {
  it("deducts seed quantity and creates plant with seedId link", async () => {
    const seed = await seedRepo.create(baseSeed);

    // Deduct some seeds
    const updatedSeed = await seedRepo.deductQuantity(seed.id, 5);
    expect(updatedSeed.quantityRemaining).toBe(20);

    // Create a new plant linked to the seed
    const plant = await plantRepo.create({
      species: seed.species,
      variety: seed.variety,
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      seedId: seed.id,
      status: "active",
      tags: [],
    });

    expect(plant.seedId).toBe(seed.id);
    expect(plant.species).toBe("Solanum lycopersicum");
    expect(plant.variety).toBe("San Marzano");
    expect(plant.source).toBe("seed");
  });

  it("creates plant + planting linked to active season", async () => {
    const seed = await seedRepo.create(baseSeed);

    // Create a season
    const season = await seasonRepo.create({
      name: "2026 Growing Season",
      year: 2026,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      isActive: true,
    });

    // Deduct and create plant
    await seedRepo.deductQuantity(seed.id, 3);
    const plant = await plantRepo.create({
      species: seed.species,
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      seedId: seed.id,
      status: "active",
      tags: [],
    });

    // Create planting for the active season
    const planting = await plantingRepo.create({
      plantInstanceId: plant.id,
      seasonId: season.id,
      datePlanted: "2026-04-15",
    });

    expect(planting.plantInstanceId).toBe(plant.id);
    expect(planting.seasonId).toBe(season.id);
    expect(planting.datePlanted).toBe("2026-04-15");

    // Verify the seed quantity was reduced
    const finalSeed = await seedRepo.getById(seed.id);
    expect(finalSeed?.quantityRemaining).toBe(22);
  });

  it("prevents planting when insufficient seed quantity", async () => {
    const seed = await seedRepo.create({
      ...baseSeed,
      quantityRemaining: 3,
    });

    await expect(seedRepo.deductQuantity(seed.id, 5)).rejects.toThrow(
      "Insufficient quantity",
    );

    // Seed should remain unchanged
    const unchanged = await seedRepo.getById(seed.id);
    expect(unchanged?.quantityRemaining).toBe(3);
  });

  it("supports deducting weight-based seeds (grams)", async () => {
    const seed = await seedRepo.create({
      ...baseSeed,
      quantityRemaining: 50.5,
      quantityUnit: "grams",
    });

    const updated = await seedRepo.deductQuantity(seed.id, 10.2);
    // Floating point: 50.5 - 10.2 = 40.3
    expect(updated.quantityRemaining).toBeCloseTo(40.3, 1);
  });
});
