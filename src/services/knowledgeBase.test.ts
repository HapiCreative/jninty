import { describe, it, expect, beforeEach } from "vitest";
import {
  loadKnowledgeBase,
  searchKnowledge,
  getBySpecies,
  getCompanions,
  clearKnowledgeBaseCache,
  builtInEntryId,
  loadAllKnowledgeItems,
  findKnowledgeItemById,
} from "./knowledgeBase.ts";
import type { UserPlantKnowledge } from "../validation/userPlantKnowledge.schema.ts";

beforeEach(() => {
  clearKnowledgeBaseCache();
});

describe("loadKnowledgeBase", () => {
  it("loads and validates all plant data", () => {
    const plants = loadKnowledgeBase();
    expect(plants.length).toBeGreaterThanOrEqual(70);
  });

  it("returns cached data on second call", () => {
    const first = loadKnowledgeBase();
    const second = loadKnowledgeBase();
    expect(first).toBe(second); // same reference
  });

  it("includes plants from all categories", () => {
    const plants = loadKnowledgeBase();
    const types = new Set(plants.map((p) => p.plantType));
    expect(types).toContain("vegetable");
    expect(types).toContain("herb");
    expect(types).toContain("flower");
    expect(types).toContain("fruit_tree");
    expect(types).toContain("berry");
  });
});

describe("searchKnowledge", () => {
  it("finds plants by common name", () => {
    const results = searchKnowledge("tomato");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((p) => p.commonName.toLowerCase().includes("tomato")))
      .toBe(true);
  });

  it("finds plants by species", () => {
    const results = searchKnowledge("Solanum lycopersicum");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("finds plants by variety", () => {
    const results = searchKnowledge("Cherry");
    expect(results.some((p) => p.variety?.toLowerCase().includes("cherry")))
      .toBe(true);
  });

  it("is case-insensitive", () => {
    const lower = searchKnowledge("basil");
    const upper = searchKnowledge("BASIL");
    expect(lower.length).toBe(upper.length);
    expect(lower.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty array for no match", () => {
    const results = searchKnowledge("xyznonexistent");
    expect(results).toEqual([]);
  });
});

describe("getBySpecies", () => {
  it("returns a plant by exact species match", () => {
    const plant = getBySpecies("Ocimum basilicum");
    expect(plant).toBeDefined();
    expect(plant?.commonName).toBe("Basil");
  });

  it("is case-insensitive", () => {
    const plant = getBySpecies("ocimum basilicum");
    expect(plant).toBeDefined();
  });

  it("returns undefined for unknown species", () => {
    const plant = getBySpecies("Nonexistus plantus");
    expect(plant).toBeUndefined();
  });
});

describe("getCompanions", () => {
  it("returns good and bad companions", () => {
    const companions = getCompanions("Solanum lycopersicum");
    expect(companions.good.length).toBeGreaterThan(0);
    expect(companions.bad.length).toBeGreaterThan(0);
  });

  it("returns empty arrays for unknown species", () => {
    const companions = getCompanions("Nonexistus plantus");
    expect(companions).toEqual({ good: [], bad: [] });
  });

  it("returns empty bad array when plant has no bad companions", () => {
    // Spinach typically has no bad companions in our data
    const companions = getCompanions("Spinacia oleracea");
    expect(companions.good.length).toBeGreaterThan(0);
    expect(companions.bad).toEqual([]);
  });
});

// ─── Unified Knowledge Base API tests ───

const mockUserEntry: UserPlantKnowledge = {
  id: "00000000-0000-0000-0000-000000000001",
  version: 1,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  species: "Custom plantus",
  commonName: "My Custom Plant",
  plantType: "vegetable",
  isPerennial: false,
  cropGroup: "my-custom-plant",
  sunNeeds: "full_sun",
  waterNeeds: "moderate",
};

describe("builtInEntryId", () => {
  it("generates deterministic id from species", () => {
    const id = builtInEntryId("Solanum lycopersicum");
    expect(id).toBe("builtin-solanum-lycopersicum");
  });

  it("includes variety in id when provided", () => {
    const id = builtInEntryId("Solanum lycopersicum", "Cherry");
    expect(id).toBe("builtin-solanum-lycopersicum-cherry");
  });

  it("normalizes special characters", () => {
    const id = builtInEntryId("Some & Special  Plant");
    expect(id).toBe("builtin-some-special-plant");
  });

  it("returns same id for same input", () => {
    const a = builtInEntryId("Ocimum basilicum");
    const b = builtInEntryId("Ocimum basilicum");
    expect(a).toBe(b);
  });
});

describe("loadAllKnowledgeItems", () => {
  it("returns built-in items when no user entries", () => {
    const items = loadAllKnowledgeItems([]);
    expect(items.length).toBeGreaterThanOrEqual(70);
    expect(items.every((i) => i.source === "builtin")).toBe(true);
  });

  it("merges user entries with built-in", () => {
    const items = loadAllKnowledgeItems([mockUserEntry]);
    expect(items.length).toBeGreaterThanOrEqual(71);
    const custom = items.filter((i) => i.source === "custom");
    expect(custom).toHaveLength(1);
    expect(custom[0]?.data.commonName).toBe("My Custom Plant");
    expect(custom[0]?.userEntry).toBeDefined();
  });

  it("sorts by commonName", () => {
    const items = loadAllKnowledgeItems([]);
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1]!;
      const curr = items[i]!;
      expect(prev.data.commonName.localeCompare(curr.data.commonName)).toBeLessThanOrEqual(0);
    }
  });

  it("built-in items have id starting with builtin-", () => {
    const items = loadAllKnowledgeItems([]);
    const builtIns = items.filter((i) => i.source === "builtin");
    expect(builtIns.every((i) => i.id.startsWith("builtin-"))).toBe(true);
  });

  it("custom items have UUID as id", () => {
    const items = loadAllKnowledgeItems([mockUserEntry]);
    const custom = items.find((i) => i.source === "custom");
    expect(custom?.id).toBe(mockUserEntry.id);
  });
});

describe("findKnowledgeItemById", () => {
  it("finds a built-in item by id", () => {
    const id = builtInEntryId("Solanum lycopersicum", "Cherry");
    const item = findKnowledgeItemById(id, []);
    expect(item).toBeDefined();
    expect(item?.source).toBe("builtin");
    expect(item?.data.species).toBe("Solanum lycopersicum");
    expect(item?.data.variety).toBe("Cherry");
  });

  it("finds a custom item by UUID", () => {
    const item = findKnowledgeItemById(mockUserEntry.id, [mockUserEntry]);
    expect(item).toBeDefined();
    expect(item?.source).toBe("custom");
    expect(item?.data.commonName).toBe("My Custom Plant");
    expect(item?.userEntry).toBeDefined();
  });

  it("returns undefined for non-existent built-in id", () => {
    const item = findKnowledgeItemById("builtin-nonexistent", []);
    expect(item).toBeUndefined();
  });

  it("returns undefined for non-existent UUID", () => {
    const item = findKnowledgeItemById(
      "00000000-0000-0000-0000-999999999999",
      [],
    );
    expect(item).toBeUndefined();
  });
});
