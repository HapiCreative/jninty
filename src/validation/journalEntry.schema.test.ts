import { describe, it, expect } from "vitest";
import { journalEntrySchema } from "./journalEntry.schema.ts";
import { validateEntity } from "./helpers.ts";

const validEntry = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  version: 0,
  createdAt: "2026-03-15T14:30:00Z",
  updatedAt: "2026-03-15T14:30:00Z",
  seasonId: "880e8400-e29b-41d4-a716-446655440003",
  activityType: "watering" as const,
  body: "Watered all the tomatoes this morning",
  photoIds: [],
  isMilestone: false,
};

describe("journalEntrySchema", () => {
  it("accepts valid minimal entry", () => {
    const result = validateEntity(journalEntrySchema, validEntry);
    expect(result.success).toBe(true);
  });

  it("accepts entry with all optional fields", () => {
    const full = {
      ...validEntry,
      plantInstanceId: "660e8400-e29b-41d4-a716-446655440001",
      bedId: "770e8400-e29b-41d4-a716-446655440002",
      seasonId: "880e8400-e29b-41d4-a716-446655440003",
      title: "Morning watering",
      isMilestone: true,
      milestoneType: "first_sprout" as const,
      harvestWeight: 2.5,
      weatherSnapshot: {
        tempC: 22,
        humidity: 65,
        conditions: "Sunny",
      },
      photoIds: [
        "990e8400-e29b-41d4-a716-446655440004",
        "aa0e8400-e29b-41d4-a716-446655440005",
      ],
    };
    const result = validateEntity(journalEntrySchema, full);
    expect(result.success).toBe(true);
  });

  it("accepts empty body string", () => {
    const result = validateEntity(journalEntrySchema, {
      ...validEntry,
      body: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing activityType", () => {
    const { activityType: _, ...noActivity } = validEntry;
    const result = validateEntity(journalEntrySchema, noActivity);
    expect(result.success).toBe(false);
  });

  it("rejects invalid activityType", () => {
    const result = validateEntity(journalEntrySchema, {
      ...validEntry,
      activityType: "sleeping",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid milestoneType", () => {
    const result = validateEntity(journalEntrySchema, {
      ...validEntry,
      isMilestone: true,
      milestoneType: "best_day_ever",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative harvestWeight", () => {
    const result = validateEntity(journalEntrySchema, {
      ...validEntry,
      harvestWeight: -1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts zero harvestWeight", () => {
    const result = validateEntity(journalEntrySchema, {
      ...validEntry,
      harvestWeight: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID in photoIds", () => {
    const result = validateEntity(journalEntrySchema, {
      ...validEntry,
      photoIds: ["not-a-uuid"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects humidity over 100", () => {
    const result = validateEntity(journalEntrySchema, {
      ...validEntry,
      weatherSnapshot: { humidity: 150 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative humidity", () => {
    const result = validateEntity(journalEntrySchema, {
      ...validEntry,
      weatherSnapshot: { humidity: -5 },
    });
    expect(result.success).toBe(false);
  });

  it("accepts weatherSnapshot with only tempC", () => {
    const result = validateEntity(journalEntrySchema, {
      ...validEntry,
      weatherSnapshot: { tempC: -10 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = validateEntity(journalEntrySchema, {
      ...validEntry,
      title: "",
    });
    expect(result.success).toBe(false);
  });

  it("validates all activity types", () => {
    const types = [
      "watering",
      "fertilizing",
      "pruning",
      "pest",
      "disease",
      "harvest",
      "transplant",
      "milestone",
      "general",
    ];
    for (const activityType of types) {
      const result = validateEntity(journalEntrySchema, {
        ...validEntry,
        activityType,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects unknown properties (strict mode)", () => {
    const result = validateEntity(journalEntrySchema, {
      ...validEntry,
      mood: "happy",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown properties in weatherSnapshot (strict mode)", () => {
    const result = validateEntity(journalEntrySchema, {
      ...validEntry,
      weatherSnapshot: { tempC: 22, windSpeed: 10 },
    });
    expect(result.success).toBe(false);
  });
});
