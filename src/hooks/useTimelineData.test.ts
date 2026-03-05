import { describe, it, expect } from "vitest";
import { computeBarSpan } from "./useTimelineData.ts";

describe("computeBarSpan", () => {
  it("gives seed_start a 3-day span", () => {
    expect(computeBarSpan("seed_start", 15, 31)).toEqual({ startDay: 15, endDay: 17 });
  });

  it("gives bed_prep a 2-day span", () => {
    expect(computeBarSpan("bed_prep", 10, 30)).toEqual({ startDay: 10, endDay: 11 });
  });

  it("gives transplant a 3-day span", () => {
    expect(computeBarSpan("transplant", 20, 28)).toEqual({ startDay: 20, endDay: 22 });
  });

  it("gives cultivate a 5-day span", () => {
    expect(computeBarSpan("cultivate", 1, 31)).toEqual({ startDay: 1, endDay: 5 });
  });

  it("gives harvest a 7-day span", () => {
    expect(computeBarSpan("harvest", 10, 31)).toEqual({ startDay: 10, endDay: 16 });
  });

  it("clamps endDay to daysInMonth", () => {
    expect(computeBarSpan("harvest", 28, 31)).toEqual({ startDay: 28, endDay: 31 });
  });

  it("handles single-day month edge (endDay = startDay when at limit)", () => {
    expect(computeBarSpan("cultivate", 31, 31)).toEqual({ startDay: 31, endDay: 31 });
  });
});
