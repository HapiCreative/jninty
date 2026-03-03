import { describe, it, expect } from "vitest";
import {
  matchesPlant,
  computeTriggerDate,
  generateSuggestions,
} from "./taskEngine.ts";
import type { TaskRule } from "../validation/taskRule.schema.ts";
import type { PlantInstance } from "../validation/plantInstance.schema.ts";
import type { Settings } from "../validation/settings.schema.ts";

// ─── Fixtures ───

const baseRule = {
  id: "rule-1",
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  appliesTo: { plantType: "vegetable" as const },
  trigger: { type: "relative_to_last_frost" as const, offsetDays: -42 },
  task: {
    title: "Start seeds indoors",
    activityType: "general" as const,
    defaultPriority: "normal" as const,
  },
  isBuiltIn: true,
} satisfies TaskRule;

const tomato = {
  id: "plant-1",
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  species: "Solanum lycopersicum",
  type: "vegetable" as const,
  isPerennial: false,
  source: "seed" as const,
  status: "active" as const,
  tags: ["container", "heirloom"],
} satisfies PlantInstance;

const basil = {
  id: "plant-2",
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  species: "Ocimum basilicum",
  type: "herb" as const,
  isPerennial: false,
  source: "seed" as const,
  status: "active" as const,
  tags: ["indoor"],
} satisfies PlantInstance;

const settings: Settings = {
  growingZone: "7b",
  lastFrostDate: "2026-04-15",
  firstFrostDate: "2026-10-15",
  gridUnit: "feet",
  temperatureUnit: "fahrenheit",
  theme: "light",
  highContrast: false,
  fontSize: "normal",
  keepOriginalPhotos: false,
  dbSchemaVersion: 6,
  exportVersion: 1,
};

// ─── matchesPlant ───

describe("matchesPlant", () => {
  it("matches by plantType", () => {
    const rule = {
      ...baseRule,
      appliesTo: { plantType: "vegetable" as const },
    };
    expect(matchesPlant(rule, tomato)).toBe(true);
    expect(matchesPlant(rule, basil)).toBe(false);
  });

  it("matches by species", () => {
    const rule = {
      ...baseRule,
      appliesTo: { species: "Solanum lycopersicum" },
    };
    expect(matchesPlant(rule, tomato)).toBe(true);
    expect(matchesPlant(rule, basil)).toBe(false);
  });

  it("matches by tagsAny (any tag matches)", () => {
    const rule = {
      ...baseRule,
      appliesTo: { tagsAny: ["container", "raised-bed"] },
    };
    expect(matchesPlant(rule, tomato)).toBe(true);
    expect(matchesPlant(rule, basil)).toBe(false);
  });

  it("requires ALL specified criteria to match", () => {
    const rule = {
      ...baseRule,
      appliesTo: {
        plantType: "vegetable" as const,
        species: "Capsicum annuum",
      },
    };
    expect(matchesPlant(rule, tomato)).toBe(false);
  });

  it("matches when all criteria match", () => {
    const rule = {
      ...baseRule,
      appliesTo: {
        plantType: "vegetable" as const,
        species: "Solanum lycopersicum",
        tagsAny: ["heirloom"],
      },
    };
    expect(matchesPlant(rule, tomato)).toBe(true);
  });

  it("skips removed/dead plants", () => {
    const dead = { ...tomato, status: "dead" as const };
    expect(matchesPlant(baseRule, dead)).toBe(false);
  });
});

// ─── computeTriggerDate ───

describe("computeTriggerDate", () => {
  it("computes relative_to_last_frost with negative offset", () => {
    const rule = {
      ...baseRule,
      trigger: { type: "relative_to_last_frost" as const, offsetDays: -42 },
    };
    const date = computeTriggerDate(rule, settings);
    expect(date).toBe("2026-03-04");
  });

  it("computes relative_to_last_frost with positive offset", () => {
    const rule = {
      ...baseRule,
      trigger: { type: "relative_to_last_frost" as const, offsetDays: 14 },
    };
    const date = computeTriggerDate(rule, settings);
    expect(date).toBe("2026-04-29");
  });

  it("computes relative_to_first_frost", () => {
    const rule = {
      ...baseRule,
      trigger: { type: "relative_to_first_frost" as const, offsetDays: -14 },
    };
    const date = computeTriggerDate(rule, settings);
    expect(date).toBe("2026-10-01");
  });

  it("computes seasonal trigger (month only)", () => {
    const rule = {
      ...baseRule,
      trigger: { type: "seasonal" as const, month: 3 },
    };
    const date = computeTriggerDate(rule, settings, 2026);
    expect(date).toBe("2026-03-01");
  });

  it("computes fixed_date trigger (month + day)", () => {
    const rule = {
      ...baseRule,
      trigger: { type: "fixed_date" as const, month: 7, day: 4 },
    };
    const date = computeTriggerDate(rule, settings, 2026);
    expect(date).toBe("2026-07-04");
  });

  it("returns undefined when offsetDays is missing for frost trigger", () => {
    const rule = {
      ...baseRule,
      trigger: { type: "relative_to_last_frost" as const },
    };
    const date = computeTriggerDate(rule, settings);
    expect(date).toBeUndefined();
  });

  it("returns undefined when month is missing for seasonal trigger", () => {
    const rule = {
      ...baseRule,
      trigger: { type: "seasonal" as const },
    };
    const date = computeTriggerDate(rule, settings);
    expect(date).toBeUndefined();
  });
});

// ─── generateSuggestions ───

describe("generateSuggestions", () => {
  it("generates a suggestion when rule matches and trigger date is today or past", () => {
    const suggestions = generateSuggestions(
      [baseRule],
      [tomato],
      settings,
      "2026-03-04",
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.title).toBe("Start seeds indoors");
    expect(suggestions[0]!.plantInstanceId).toBe("plant-1");
    expect(suggestions[0]!.ruleId).toBe("rule-1");
    expect(suggestions[0]!.isAutoGenerated).toBe(true);
    expect(suggestions[0]!.dueDate).toBe("2026-03-04");
    expect(suggestions[0]!.priority).toBe("normal");
  });

  it("generates suggestion when trigger date is in the past", () => {
    const suggestions = generateSuggestions(
      [baseRule],
      [tomato],
      settings,
      "2026-03-10",
    );
    expect(suggestions).toHaveLength(1);
  });

  it("does NOT generate suggestion when trigger date is in the future", () => {
    const suggestions = generateSuggestions(
      [baseRule],
      [tomato],
      settings,
      "2026-02-01",
    );
    expect(suggestions).toHaveLength(0);
  });

  it("does NOT generate suggestion when plant does not match", () => {
    const suggestions = generateSuggestions(
      [baseRule],
      [basil],
      settings,
      "2026-03-04",
    );
    expect(suggestions).toHaveLength(0);
  });

  it("generates suggestions for multiple plants matching same rule", () => {
    const pepper = { ...tomato, id: "plant-3", species: "Capsicum annuum" };
    const suggestions = generateSuggestions(
      [baseRule],
      [tomato, pepper],
      settings,
      "2026-03-04",
    );
    expect(suggestions).toHaveLength(2);
  });

  it("deduplicates by ruleId + plantInstanceId", () => {
    const existingTaskKeys = new Set(["rule-1::plant-1"]);
    const suggestions = generateSuggestions(
      [baseRule],
      [tomato],
      settings,
      "2026-03-04",
      existingTaskKeys,
    );
    expect(suggestions).toHaveLength(0);
  });

  it("uses activityType from rule when provided", () => {
    const rule = {
      ...baseRule,
      task: { ...baseRule.task, activityType: "pruning" as const },
    };
    const suggestions = generateSuggestions(
      [rule],
      [tomato],
      settings,
      "2026-03-04",
    );
    expect(suggestions[0]!.activityType).toBe("pruning");
  });

  it("defaults priority to normal when rule omits it", () => {
    const rule = {
      ...baseRule,
      task: { title: "Do thing" },
    };
    const suggestions = generateSuggestions(
      [rule],
      [tomato],
      settings,
      "2026-03-04",
    );
    expect(suggestions[0]!.priority).toBe("normal");
  });
});
