import { describe, it, expect, beforeEach } from "vitest";
import { clearKnowledgeBaseCache } from "./knowledgeBase.ts";
import {
  analyzeBedCompanions,
  getPlantTokenStatuses,
} from "./companionAnalysis.ts";
import type { Planting } from "../validation/planting.schema.ts";
import type { PlantInstance } from "../validation/plantInstance.schema.ts";

// ─── Test helpers ───

const now = new Date().toISOString();

function makePlant(
  overrides: Partial<PlantInstance> & { id: string; species: string },
): PlantInstance {
  return {
    type: "vegetable",
    isPerennial: false,
    source: "seed",
    status: "active",
    tags: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makePlanting(
  overrides: Partial<Planting> & {
    id: string;
    plantInstanceId: string;
    bedId: string;
  },
): Planting {
  return {
    seasonId: "season-1",
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function buildMap(plants: PlantInstance[]): Map<string, PlantInstance> {
  const m = new Map<string, PlantInstance>();
  for (const p of plants) {
    m.set(p.id, p);
  }
  return m;
}

// ─── Tests ───

beforeEach(() => {
  clearKnowledgeBaseCache();
});

describe("analyzeBedCompanions", () => {
  it("detects good pairings (tomato + basil)", () => {
    const tomato = makePlant({
      id: "p1",
      species: "Solanum lycopersicum",
      nickname: "Tomato",
    });
    const basil = makePlant({
      id: "p2",
      species: "Ocimum basilicum",
      nickname: "Basil",
      type: "herb",
    });

    const plantings: Planting[] = [
      makePlanting({ id: "pl1", plantInstanceId: "p1", bedId: "bed-1" }),
      makePlanting({ id: "pl2", plantInstanceId: "p2", bedId: "bed-1" }),
    ];

    const report = analyzeBedCompanions(
      "bed-1",
      plantings,
      buildMap([tomato, basil]),
    );

    expect(report.goodPairings.length).toBeGreaterThan(0);
    const hasBasilPairing = report.goodPairings.some(
      (p) =>
        (p.plantA.id === "p1" && p.plantB.id === "p2") ||
        (p.plantA.id === "p2" && p.plantB.id === "p1"),
    );
    expect(hasBasilPairing).toBe(true);
  });

  it("detects bad pairings (tomato + fennel)", () => {
    const tomato = makePlant({
      id: "p1",
      species: "Solanum lycopersicum",
      nickname: "Tomato",
    });
    const fennel = makePlant({
      id: "p2",
      species: "Foeniculum vulgare",
      nickname: "Fennel",
      type: "herb",
    });

    const plantings: Planting[] = [
      makePlanting({ id: "pl1", plantInstanceId: "p1", bedId: "bed-1" }),
      makePlanting({ id: "pl2", plantInstanceId: "p2", bedId: "bed-1" }),
    ];

    const report = analyzeBedCompanions(
      "bed-1",
      plantings,
      buildMap([tomato, fennel]),
    );

    expect(report.badPairings.length).toBeGreaterThan(0);
    const hasFennelConflict = report.badPairings.some(
      (p) =>
        (p.plantA.id === "p1" && p.plantB.id === "p2") ||
        (p.plantA.id === "p2" && p.plantB.id === "p1"),
    );
    expect(hasFennelConflict).toBe(true);
  });

  it("returns empty report for empty bed", () => {
    const report = analyzeBedCompanions("bed-1", [], new Map());
    expect(report.goodPairings).toEqual([]);
    expect(report.badPairings).toEqual([]);
    expect(report.suggestions).toEqual([]);
  });

  it("generates suggestions for solo plants", () => {
    const tomato = makePlant({
      id: "p1",
      species: "Solanum lycopersicum",
      nickname: "Tomato",
    });

    const plantings: Planting[] = [
      makePlanting({ id: "pl1", plantInstanceId: "p1", bedId: "bed-1" }),
    ];

    const report = analyzeBedCompanions(
      "bed-1",
      plantings,
      buildMap([tomato]),
    );

    expect(report.suggestions.length).toBeGreaterThan(0);
    expect(report.suggestions.length).toBeLessThanOrEqual(3);
    expect(report.suggestions[0]!.forPlant.id).toBe("p1");
  });

  it("handles plants with no knowledge base entry gracefully", () => {
    const unknown = makePlant({
      id: "p1",
      species: "Nonexistus plantus",
      nickname: "Unknown",
    });

    const plantings: Planting[] = [
      makePlanting({ id: "pl1", plantInstanceId: "p1", bedId: "bed-1" }),
    ];

    const report = analyzeBedCompanions(
      "bed-1",
      plantings,
      buildMap([unknown]),
    );

    expect(report.goodPairings).toEqual([]);
    expect(report.badPairings).toEqual([]);
    expect(report.suggestions).toEqual([]);
  });

  it("deduplicates symmetric pairings", () => {
    // Tomato says basil is good, basil says tomato is good —
    // should only appear once
    const tomato = makePlant({
      id: "p1",
      species: "Solanum lycopersicum",
      nickname: "Tomato",
    });
    const basil = makePlant({
      id: "p2",
      species: "Ocimum basilicum",
      nickname: "Basil",
      type: "herb",
    });

    const plantings: Planting[] = [
      makePlanting({ id: "pl1", plantInstanceId: "p1", bedId: "bed-1" }),
      makePlanting({ id: "pl2", plantInstanceId: "p2", bedId: "bed-1" }),
    ];

    const report = analyzeBedCompanions(
      "bed-1",
      plantings,
      buildMap([tomato, basil]),
    );

    // Check that the "basil" tag pairing only appears once
    const basilPairings = report.goodPairings.filter(
      (p) => p.tag === "basil",
    );
    expect(basilPairings.length).toBe(1);

    // And the "tomato" tag pairing only appears once
    const tomatoPairings = report.goodPairings.filter(
      (p) => p.tag === "tomato",
    );
    expect(tomatoPairings.length).toBe(1);
  });

  it("only includes plantings for the specified bed", () => {
    const tomato = makePlant({
      id: "p1",
      species: "Solanum lycopersicum",
      nickname: "Tomato",
    });
    const basil = makePlant({
      id: "p2",
      species: "Ocimum basilicum",
      nickname: "Basil",
      type: "herb",
    });

    const plantings: Planting[] = [
      makePlanting({ id: "pl1", plantInstanceId: "p1", bedId: "bed-1" }),
      makePlanting({ id: "pl2", plantInstanceId: "p2", bedId: "bed-2" }), // different bed
    ];

    const report = analyzeBedCompanions(
      "bed-1",
      plantings,
      buildMap([tomato, basil]),
    );

    expect(report.goodPairings).toEqual([]);
    expect(report.badPairings).toEqual([]);
  });
  it("detects bad pairings via group name expansion (brassicas)", () => {
    // Tomato has badCompanions: ["brassicas"], broccoli is a brassica
    const tomato = makePlant({
      id: "p1",
      species: "Solanum lycopersicum",
      nickname: "Tomato",
    });
    const broccoli = makePlant({
      id: "p2",
      species: "Brassica oleracea var. italica",
      nickname: "Broccoli",
    });

    const plantings: Planting[] = [
      makePlanting({ id: "pl1", plantInstanceId: "p1", bedId: "bed-1" }),
      makePlanting({ id: "pl2", plantInstanceId: "p2", bedId: "bed-1" }),
    ];

    const report = analyzeBedCompanions(
      "bed-1",
      plantings,
      buildMap([tomato, broccoli]),
    );

    expect(report.badPairings.length).toBeGreaterThan(0);
    const hasBrassicaConflict = report.badPairings.some(
      (p) => p.tag === "brassicas",
    );
    expect(hasBrassicaConflict).toBe(true);
  });
});

describe("getPlantTokenStatuses", () => {
  it("returns good status for beneficial pairings", () => {
    const tomato = makePlant({
      id: "p1",
      species: "Solanum lycopersicum",
      nickname: "Tomato",
    });
    const basil = makePlant({
      id: "p2",
      species: "Ocimum basilicum",
      nickname: "Basil",
      type: "herb",
    });

    const plantings: Planting[] = [
      makePlanting({ id: "pl1", plantInstanceId: "p1", bedId: "bed-1" }),
      makePlanting({ id: "pl2", plantInstanceId: "p2", bedId: "bed-1" }),
    ];

    const statuses = getPlantTokenStatuses(
      "bed-1",
      plantings,
      buildMap([tomato, basil]),
    );

    const tomatoStatus = statuses.get("p1");
    expect(tomatoStatus).toBeDefined();
    expect(tomatoStatus!.status).toBe("good");
    expect(tomatoStatus!.messages.length).toBeGreaterThan(0);
  });

  it("returns bad status for conflict pairings", () => {
    const tomato = makePlant({
      id: "p1",
      species: "Solanum lycopersicum",
      nickname: "Tomato",
    });
    const fennel = makePlant({
      id: "p2",
      species: "Foeniculum vulgare",
      nickname: "Fennel",
      type: "herb",
    });

    const plantings: Planting[] = [
      makePlanting({ id: "pl1", plantInstanceId: "p1", bedId: "bed-1" }),
      makePlanting({ id: "pl2", plantInstanceId: "p2", bedId: "bed-1" }),
    ];

    const statuses = getPlantTokenStatuses(
      "bed-1",
      plantings,
      buildMap([tomato, fennel]),
    );

    const tomatoStatus = statuses.get("p1");
    expect(tomatoStatus).toBeDefined();
    expect(tomatoStatus!.status).toBe("bad");
  });

  it("bad overrides good when plant has both", () => {
    // Tomato with basil (good) and fennel (bad)
    const tomato = makePlant({
      id: "p1",
      species: "Solanum lycopersicum",
      nickname: "Tomato",
    });
    const basil = makePlant({
      id: "p2",
      species: "Ocimum basilicum",
      nickname: "Basil",
      type: "herb",
    });
    const fennel = makePlant({
      id: "p3",
      species: "Foeniculum vulgare",
      nickname: "Fennel",
      type: "herb",
    });

    const plantings: Planting[] = [
      makePlanting({ id: "pl1", plantInstanceId: "p1", bedId: "bed-1" }),
      makePlanting({ id: "pl2", plantInstanceId: "p2", bedId: "bed-1" }),
      makePlanting({ id: "pl3", plantInstanceId: "p3", bedId: "bed-1" }),
    ];

    const statuses = getPlantTokenStatuses(
      "bed-1",
      plantings,
      buildMap([tomato, basil, fennel]),
    );

    const tomatoStatus = statuses.get("p1");
    expect(tomatoStatus).toBeDefined();
    expect(tomatoStatus!.status).toBe("bad");
    // Should include both bad and good messages
    expect(
      tomatoStatus!.messages.some((m) => m.includes("Conflict")),
    ).toBe(true);
    expect(
      tomatoStatus!.messages.some((m) => m.includes("Good companion")),
    ).toBe(true);
  });

  it("returns empty map for unknown species", () => {
    const unknown = makePlant({
      id: "p1",
      species: "Nonexistus plantus",
      nickname: "Unknown",
    });

    const plantings: Planting[] = [
      makePlanting({ id: "pl1", plantInstanceId: "p1", bedId: "bed-1" }),
    ];

    const statuses = getPlantTokenStatuses(
      "bed-1",
      plantings,
      buildMap([unknown]),
    );

    expect(statuses.size).toBe(0);
  });
});
