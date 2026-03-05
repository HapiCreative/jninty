import { describe, it, expect } from "vitest";
import {
  computeTaskDates,
  buildTaskInputs,
  computeRescheduleUpdates,
  computeLateCompletionDelta,
  computeDownstreamUpdates,
  computeScheduleDateUpdates,
} from "./schedulingService.ts";

describe("computeTaskDates", () => {
  const transplantVariety = {
    daysToMaturity: 65,
    daysToTransplant: 42,
    bedPrepLeadDays: 7,
    harvestWindowDays: 60,
    indoorStart: true,
    directSow: false,
  };

  const directSowVariety = {
    daysToMaturity: 70,
    daysToTransplant: null,
    bedPrepLeadDays: 0,
    harvestWindowDays: 30,
    indoorStart: false,
    directSow: true,
  };

  describe("forward direction (from seed start)", () => {
    it("computes correct dates for transplant variety", () => {
      const dates = computeTaskDates(transplantVariety, "2026-03-15", "forward");
      expect(dates.seedStartDate).toBe("2026-03-15");
      // transplant = Mar 15 + 42 = Apr 26
      expect(dates.transplantDate).toBe("2026-04-26");
      // bedPrep = Apr 26 - 7 = Apr 19
      expect(dates.bedPrepDate).toBe("2026-04-19");
      // cultivate = Apr 26 + 7 = May 3
      expect(dates.cultivateStartDate).toBe("2026-05-03");
      // harvest start = Apr 26 + 65 = Jun 30
      expect(dates.harvestStartDate).toBe("2026-06-30");
      // harvest end = Jun 30 + 60 = Aug 29
      expect(dates.harvestEndDate).toBe("2026-08-29");
    });

    it("computes correct dates for direct sow variety", () => {
      const dates = computeTaskDates(directSowVariety, "2026-04-15", "forward");
      expect(dates.seedStartDate).toBeUndefined();
      expect(dates.transplantDate).toBeUndefined();
      expect(dates.bedPrepDate).toBeUndefined();
      // cultivate = Apr 15 + 7 = Apr 22
      expect(dates.cultivateStartDate).toBe("2026-04-22");
      // harvest start = Apr 15 + 70 = Jun 24
      expect(dates.harvestStartDate).toBe("2026-06-24");
      // harvest end = Jun 24 + 30 = Jul 24
      expect(dates.harvestEndDate).toBe("2026-07-24");
    });

    it("skips bedPrep when bedPrepLeadDays is 0", () => {
      const variety = { ...transplantVariety, bedPrepLeadDays: 0 };
      const dates = computeTaskDates(variety, "2026-03-15", "forward");
      expect(dates.bedPrepDate).toBeUndefined();
    });
  });

  describe("backward direction (from harvest target)", () => {
    it("computes correct dates for transplant variety", () => {
      const dates = computeTaskDates(transplantVariety, "2026-08-29", "backward");
      // harvest end = Aug 29
      expect(dates.harvestEndDate).toBe("2026-08-29");
      // harvest start = Aug 29 - 60 = Jun 30
      expect(dates.harvestStartDate).toBe("2026-06-30");
      // transplant = Jun 30 - 65 = Apr 26
      expect(dates.transplantDate).toBe("2026-04-26");
      // bedPrep = Apr 26 - 7 = Apr 19
      expect(dates.bedPrepDate).toBe("2026-04-19");
      // cultivate = Apr 26 + 7 = May 3
      expect(dates.cultivateStartDate).toBe("2026-05-03");
      // seed start = Apr 26 - 42 = Mar 15
      expect(dates.seedStartDate).toBe("2026-03-15");
    });

    it("computes correct dates for direct sow variety", () => {
      const dates = computeTaskDates(directSowVariety, "2026-07-24", "backward");
      expect(dates.harvestEndDate).toBe("2026-07-24");
      // harvest start = Jul 24 - 30 = Jun 24
      expect(dates.harvestStartDate).toBe("2026-06-24");
      // sow date = Jun 24 - 70 = Apr 15
      // cultivate = Apr 15 + 7 = Apr 22
      expect(dates.cultivateStartDate).toBe("2026-04-22");
      expect(dates.seedStartDate).toBeUndefined();
      expect(dates.transplantDate).toBeUndefined();
    });
  });

  describe("round-trip consistency", () => {
    it("forward then backward produces the same dates", () => {
      const forward = computeTaskDates(transplantVariety, "2026-03-15", "forward");
      const backward = computeTaskDates(transplantVariety, forward.harvestEndDate, "backward");
      expect(backward.seedStartDate).toBe(forward.seedStartDate);
      expect(backward.transplantDate).toBe(forward.transplantDate);
      expect(backward.harvestStartDate).toBe(forward.harvestStartDate);
    });
  });
});

describe("buildTaskInputs", () => {
  it("creates task inputs for transplant variety dates", () => {
    const dates = {
      seedStartDate: "2026-03-15",
      bedPrepDate: "2026-04-19",
      transplantDate: "2026-04-26",
      cultivateStartDate: "2026-05-03",
      harvestStartDate: "2026-06-30",
      harvestEndDate: "2026-08-29",
    };

    const tasks = buildTaskInputs(
      dates,
      "schedule-123",
      "Tomato",
      "Cherry",
      "bed-456",
      "Raised Bed A",
    );

    expect(tasks).toHaveLength(5);
    expect(tasks[0]!.taskType).toBe("seed_start");
    expect(tasks[0]!.scheduledDate).toBe("2026-03-15");
    expect(tasks[0]!.sequenceOrder).toBe(0);
    expect(tasks[0]!.title).toBe("Start Cherry Tomato seeds indoors");

    expect(tasks[1]!.taskType).toBe("bed_prep");
    expect(tasks[1]!.scheduledDate).toBe("2026-04-19");
    expect(tasks[1]!.sequenceOrder).toBe(1);

    expect(tasks[2]!.taskType).toBe("transplant");
    expect(tasks[2]!.sequenceOrder).toBe(2);

    expect(tasks[3]!.taskType).toBe("cultivate");
    expect(tasks[3]!.sequenceOrder).toBe(3);

    expect(tasks[4]!.taskType).toBe("harvest");
    expect(tasks[4]!.sequenceOrder).toBe(4);
    expect(tasks[4]!.scheduledDate).toBe("2026-06-30");
  });

  it("omits tasks for undefined dates", () => {
    const dates = {
      cultivateStartDate: "2026-04-22",
      harvestStartDate: "2026-06-24",
      harvestEndDate: "2026-07-24",
    };

    const tasks = buildTaskInputs(dates, "s1", "Carrot", "Nantes");
    expect(tasks).toHaveLength(2);
    expect(tasks[0]!.taskType).toBe("cultivate");
    expect(tasks[1]!.taskType).toBe("harvest");
  });

  it("includes bed info when provided", () => {
    const dates = {
      harvestStartDate: "2026-06-01",
      harvestEndDate: "2026-07-01",
    };
    const tasks = buildTaskInputs(dates, "s1", "Herb", "Basil", "b1", "Herb Box");
    expect(tasks[0]!.bedId).toBe("b1");
    expect(tasks[0]!.bedName).toBe("Herb Box");
  });
});

describe("computeRescheduleUpdates", () => {
  it("shifts dates by the given delta", () => {
    const tasks = [
      { id: "t1", scheduledDate: "2026-04-01" },
      { id: "t2", scheduledDate: "2026-04-15" },
    ];
    const updates = computeRescheduleUpdates(tasks, 5);
    expect(updates).toEqual([
      { id: "t1", changes: { scheduledDate: "2026-04-06" } },
      { id: "t2", changes: { scheduledDate: "2026-04-20" } },
    ]);
  });

  it("handles negative delta", () => {
    const tasks = [{ id: "t1", scheduledDate: "2026-04-10" }];
    const updates = computeRescheduleUpdates(tasks, -3);
    expect(updates).toEqual([
      { id: "t1", changes: { scheduledDate: "2026-04-07" } },
    ]);
  });
});

describe("computeLateCompletionDelta", () => {
  it("returns positive delta when completed late", () => {
    expect(computeLateCompletionDelta("2026-04-01", "2026-04-05")).toBe(4);
  });

  it("returns zero when completed on time", () => {
    expect(computeLateCompletionDelta("2026-04-01", "2026-04-01")).toBe(0);
  });

  it("returns negative when completed early", () => {
    expect(computeLateCompletionDelta("2026-04-05", "2026-04-03")).toBe(-2);
  });
});

describe("computeDownstreamUpdates", () => {
  it("returns updates when delta is positive", () => {
    const downstream = [
      { id: "t1", scheduledDate: "2026-04-10" },
      { id: "t2", scheduledDate: "2026-05-01" },
    ];
    const updates = computeDownstreamUpdates(downstream, 4);
    expect(updates).toHaveLength(2);
    expect(updates[0]!.changes.scheduledDate).toBe("2026-04-14");
    expect(updates[1]!.changes.scheduledDate).toBe("2026-05-05");
  });

  it("returns empty array when delta is zero or negative", () => {
    const downstream = [{ id: "t1", scheduledDate: "2026-04-10" }];
    expect(computeDownstreamUpdates(downstream, 0)).toEqual([]);
    expect(computeDownstreamUpdates(downstream, -2)).toEqual([]);
  });
});

describe("computeScheduleDateUpdates", () => {
  it("maps task types to corresponding ComputedDates fields", () => {
    const tasks = [
      { taskType: "seed_start" as const, scheduledDate: "2026-03-15" },
      { taskType: "bed_prep" as const, scheduledDate: "2026-04-19" },
      { taskType: "transplant" as const, scheduledDate: "2026-04-26" },
      { taskType: "cultivate" as const, scheduledDate: "2026-05-03" },
      { taskType: "harvest" as const, scheduledDate: "2026-06-30" },
    ];

    const result = computeScheduleDateUpdates(tasks, 60);

    expect(result.seedStartDate).toBe("2026-03-15");
    expect(result.bedPrepDate).toBe("2026-04-19");
    expect(result.transplantDate).toBe("2026-04-26");
    expect(result.cultivateStartDate).toBe("2026-05-03");
    expect(result.harvestStartDate).toBe("2026-06-30");
    // harvest end = Jun 30 + 60 = Aug 29
    expect(result.harvestEndDate).toBe("2026-08-29");
  });

  it("computes harvestEndDate from scheduledDate + harvestWindowDays", () => {
    const tasks = [
      { taskType: "harvest" as const, scheduledDate: "2026-07-01" },
    ];

    const result = computeScheduleDateUpdates(tasks, 30);
    expect(result.harvestStartDate).toBe("2026-07-01");
    // Jul 1 + 30 = Jul 31
    expect(result.harvestEndDate).toBe("2026-07-31");
  });

  it("returns only fields for present task types", () => {
    const tasks = [
      { taskType: "cultivate" as const, scheduledDate: "2026-05-03" },
      { taskType: "harvest" as const, scheduledDate: "2026-06-30" },
    ];

    const result = computeScheduleDateUpdates(tasks, 14);
    expect(result.seedStartDate).toBeUndefined();
    expect(result.bedPrepDate).toBeUndefined();
    expect(result.transplantDate).toBeUndefined();
    expect(result.cultivateStartDate).toBe("2026-05-03");
    expect(result.harvestStartDate).toBe("2026-06-30");
  });

  it("handles empty task array", () => {
    const result = computeScheduleDateUpdates([], 30);
    expect(result).toEqual({});
  });
});
