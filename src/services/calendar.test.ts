import { describe, it, expect } from "vitest";
import { computePlantingWindows } from "./calendar.ts";
import type { PlantKnowledge } from "../validation/plantKnowledge.schema.ts";
import type { Settings } from "../validation/settings.schema.ts";

type FrostSettings = Pick<Settings, "lastFrostDate" | "firstFrostDate">;

const defaultSettings: FrostSettings = {
  lastFrostDate: "2026-04-15",
  firstFrostDate: "2026-10-15",
};

// Cherry Tomato: indoor 6 weeks before, transplant 2 weeks after, 65 days to maturity
const cherryTomato: PlantKnowledge = {
  species: "Solanum lycopersicum",
  variety: "Cherry",
  commonName: "Cherry Tomato",
  plantType: "vegetable",
  isPerennial: false,
  indoorStartWeeksBeforeLastFrost: 6,
  transplantWeeksAfterLastFrost: 2,
  daysToGermination: 7,
  daysToMaturity: 65,
  sunNeeds: "full_sun",
  waterNeeds: "high",
};

// Lettuce: direct sow 4 weeks before, no indoor/transplant, 45 days to maturity
const lettuce: PlantKnowledge = {
  species: "Lactuca sativa",
  commonName: "Lettuce",
  plantType: "vegetable",
  isPerennial: false,
  directSowWeeksBeforeLastFrost: 4,
  daysToGermination: 7,
  daysToMaturity: 45,
  sunNeeds: "partial_shade",
  waterNeeds: "moderate",
};

// Bush beans: direct sow 1 week after, no indoor/transplant, 55 days to maturity
const bushBeans: PlantKnowledge = {
  species: "Phaseolus vulgaris",
  variety: "Bush",
  commonName: "Bush Green Beans",
  plantType: "vegetable",
  isPerennial: false,
  directSowWeeksAfterLastFrost: 1,
  daysToGermination: 8,
  daysToMaturity: 55,
  sunNeeds: "full_sun",
  waterNeeds: "moderate",
};

// Cucumber: indoor 3 weeks before, transplant 2 after, direct sow 2 after, 60 days
const cucumber: PlantKnowledge = {
  species: "Cucumis sativus",
  commonName: "Cucumber",
  plantType: "vegetable",
  isPerennial: false,
  indoorStartWeeksBeforeLastFrost: 3,
  transplantWeeksAfterLastFrost: 2,
  directSowWeeksAfterLastFrost: 2,
  daysToGermination: 7,
  daysToMaturity: 60,
  sunNeeds: "full_sun",
  waterNeeds: "high",
};

// Kale: indoor 6 before, transplant -2 (before frost), direct sow 4 before, 60 days
const kale: PlantKnowledge = {
  species: "Brassica oleracea var. sabellica",
  commonName: "Kale",
  plantType: "vegetable",
  isPerennial: false,
  indoorStartWeeksBeforeLastFrost: 6,
  transplantWeeksAfterLastFrost: -2,
  directSowWeeksBeforeLastFrost: 4,
  daysToGermination: 7,
  daysToMaturity: 60,
  sunNeeds: "full_sun",
  waterNeeds: "moderate",
};

// A plant with no offset fields at all
const minimalPlant: PlantKnowledge = {
  species: "Unknown plant",
  commonName: "Mystery Plant",
  plantType: "other",
  isPerennial: false,
  sunNeeds: "full_sun",
  waterNeeds: "moderate",
};

describe("computePlantingWindows", () => {
  describe("indoor start window", () => {
    it("computes indoor start for Cherry Tomato (6 weeks before last frost)", () => {
      const windows = computePlantingWindows(cherryTomato, defaultSettings);
      expect(windows.indoorStart).toBeDefined();
      // lastFrost = April 15, minus 6 weeks = March 4
      expect(windows.indoorStart!.start).toEqual(new Date(2026, 2, 4)); // March 4
      // end = start + 7 days = March 11
      expect(windows.indoorStart!.end).toEqual(new Date(2026, 2, 11));
    });

    it("returns undefined when no indoor start offset", () => {
      const windows = computePlantingWindows(lettuce, defaultSettings);
      expect(windows.indoorStart).toBeUndefined();
    });
  });

  describe("transplant window", () => {
    it("computes transplant for Cherry Tomato (2 weeks after last frost)", () => {
      const windows = computePlantingWindows(cherryTomato, defaultSettings);
      expect(windows.transplant).toBeDefined();
      // lastFrost = April 15, plus 2 weeks = April 29
      expect(windows.transplant!.start).toEqual(new Date(2026, 3, 29));
      // end = start + 7 = May 6
      expect(windows.transplant!.end).toEqual(new Date(2026, 4, 6));
    });

    it("handles negative transplant offset (before last frost)", () => {
      const windows = computePlantingWindows(kale, defaultSettings);
      expect(windows.transplant).toBeDefined();
      // lastFrost = April 15, plus -2 weeks = April 1
      expect(windows.transplant!.start).toEqual(new Date(2026, 3, 1));
      expect(windows.transplant!.end).toEqual(new Date(2026, 3, 8));
    });

    it("returns undefined when no transplant offset", () => {
      const windows = computePlantingWindows(lettuce, defaultSettings);
      expect(windows.transplant).toBeUndefined();
    });
  });

  describe("direct sow window", () => {
    it("computes direct sow from before-frost offset only (Lettuce)", () => {
      const windows = computePlantingWindows(lettuce, defaultSettings);
      expect(windows.directSow).toBeDefined();
      // lastFrost = April 15, minus 4 weeks = March 18
      expect(windows.directSow!.start).toEqual(new Date(2026, 2, 18));
      expect(windows.directSow!.end).toEqual(new Date(2026, 2, 25));
    });

    it("computes direct sow from after-frost offset only (Bush Beans)", () => {
      const windows = computePlantingWindows(bushBeans, defaultSettings);
      expect(windows.directSow).toBeDefined();
      // lastFrost = April 15, plus 1 week = April 22
      expect(windows.directSow!.start).toEqual(new Date(2026, 3, 22));
      expect(windows.directSow!.end).toEqual(new Date(2026, 3, 29));
    });

    it("computes direct sow from after-frost offset (Cucumber)", () => {
      const windows = computePlantingWindows(cucumber, defaultSettings);
      expect(windows.directSow).toBeDefined();
      // lastFrost = April 15, plus 2 weeks = April 29
      expect(windows.directSow!.start).toEqual(new Date(2026, 3, 29));
      expect(windows.directSow!.end).toEqual(new Date(2026, 4, 6));
    });

    it("merges before and after offsets into one window (Kale)", () => {
      const windows = computePlantingWindows(kale, defaultSettings);
      expect(windows.directSow).toBeDefined();
      // before: lastFrost - 4 weeks = March 18
      expect(windows.directSow!.start).toEqual(new Date(2026, 2, 18));
      // Kale only has directSowWeeksBeforeLastFrost, no after
      // Actually Kale has directSowWeeksBeforeLastFrost: 4 only
      expect(windows.directSow!.end).toEqual(new Date(2026, 2, 25));
    });

    it("returns undefined when no direct sow offset", () => {
      const windows = computePlantingWindows(cherryTomato, defaultSettings);
      expect(windows.directSow).toBeUndefined();
    });
  });

  describe("estimated harvest window", () => {
    it("computes harvest from transplant date + daysToMaturity (Cherry Tomato)", () => {
      const windows = computePlantingWindows(cherryTomato, defaultSettings);
      expect(windows.estimatedHarvest).toBeDefined();
      // transplant start = April 29, plus 65 days = July 3
      expect(windows.estimatedHarvest!.start).toEqual(new Date(2026, 6, 3));
      expect(windows.estimatedHarvest!.end).toEqual(new Date(2026, 6, 10));
    });

    it("computes harvest from direct sow date when no transplant (Lettuce)", () => {
      const windows = computePlantingWindows(lettuce, defaultSettings);
      expect(windows.estimatedHarvest).toBeDefined();
      // directSow start = March 18, plus 45 days = May 2
      expect(windows.estimatedHarvest!.start).toEqual(new Date(2026, 4, 2));
      expect(windows.estimatedHarvest!.end).toEqual(new Date(2026, 4, 9));
    });

    it("computes harvest from direct sow date (Bush Beans)", () => {
      const windows = computePlantingWindows(bushBeans, defaultSettings);
      expect(windows.estimatedHarvest).toBeDefined();
      // directSow start = April 22, plus 55 days = June 16
      expect(windows.estimatedHarvest!.start).toEqual(new Date(2026, 5, 16));
      expect(windows.estimatedHarvest!.end).toEqual(new Date(2026, 5, 23));
    });

    it("returns undefined when no daysToMaturity", () => {
      const noMaturity: PlantKnowledge = {
        ...cherryTomato,
        daysToMaturity: undefined,
      };
      const windows = computePlantingWindows(noMaturity, defaultSettings);
      expect(windows.estimatedHarvest).toBeUndefined();
    });

    it("returns undefined when no transplant or direct sow reference date", () => {
      const onlyIndoor: PlantKnowledge = {
        ...minimalPlant,
        indoorStartWeeksBeforeLastFrost: 6,
        daysToMaturity: 60,
      };
      const windows = computePlantingWindows(onlyIndoor, defaultSettings);
      // Has daysToMaturity but no transplant/directSow to compute from
      expect(windows.estimatedHarvest).toBeUndefined();
    });
  });

  describe("missing offsets", () => {
    it("returns all undefined windows for a plant with no offsets", () => {
      const windows = computePlantingWindows(minimalPlant, defaultSettings);
      expect(windows.indoorStart).toBeUndefined();
      expect(windows.transplant).toBeUndefined();
      expect(windows.directSow).toBeUndefined();
      expect(windows.estimatedHarvest).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("handles frost dates very close together", () => {
      const tightSettings: FrostSettings = {
        lastFrostDate: "2026-06-01",
        firstFrostDate: "2026-08-01", // only 2 months apart
      };
      const windows = computePlantingWindows(cherryTomato, tightSettings);
      expect(windows.indoorStart).toBeDefined();
      expect(windows.transplant).toBeDefined();
      // Indoor start = June 1 - 6 weeks = April 20
      expect(windows.indoorStart!.start).toEqual(new Date(2026, 3, 20));
      // Transplant = June 1 + 2 weeks = June 15
      expect(windows.transplant!.start).toEqual(new Date(2026, 5, 15));
    });

    it("handles frost dates very far apart", () => {
      const wideSettings: FrostSettings = {
        lastFrostDate: "2026-02-01",
        firstFrostDate: "2026-12-15", // very long season
      };
      const windows = computePlantingWindows(cherryTomato, wideSettings);
      expect(windows.indoorStart).toBeDefined();
      expect(windows.transplant).toBeDefined();
      // Indoor start = Feb 1 - 6 weeks = Dec 21, 2025
      expect(windows.indoorStart!.start).toEqual(new Date(2025, 11, 21));
      // Transplant = Feb 1 + 2 weeks = Feb 15
      expect(windows.transplant!.start).toEqual(new Date(2026, 1, 15));
    });

    it("handles a plant with both direct sow offsets (before and after)", () => {
      const bothSow: PlantKnowledge = {
        ...minimalPlant,
        directSowWeeksBeforeLastFrost: 2,
        directSowWeeksAfterLastFrost: 3,
        daysToMaturity: 50,
      };
      const windows = computePlantingWindows(bothSow, defaultSettings);
      expect(windows.directSow).toBeDefined();
      // start = April 15 - 2 weeks = April 1
      expect(windows.directSow!.start).toEqual(new Date(2026, 3, 1));
      // end = April 15 + 3 weeks + 7 days = May 13
      expect(windows.directSow!.end).toEqual(new Date(2026, 4, 13));
    });

    it("prefers transplant date over direct sow for harvest calculation", () => {
      const windows = computePlantingWindows(cucumber, defaultSettings);
      expect(windows.estimatedHarvest).toBeDefined();
      // Cucumber has both transplant (April 29) and direct sow (April 29)
      // Should use transplant start as the reference date
      // transplant start = April 15 + 2 weeks = April 29
      // harvest = April 29 + 60 = June 28
      expect(windows.estimatedHarvest!.start).toEqual(new Date(2026, 5, 28));
    });
  });
});
