import { addDays, differenceInCalendarDays, formatISO, parseISO } from "date-fns";
import type { ScheduleTaskType } from "../validation/scheduleTask.schema.ts";

// ─── Types ───

export interface ComputedDates {
  seedStartDate?: string;
  bedPrepDate?: string;
  transplantDate?: string;
  cultivateStartDate?: string;
  harvestStartDate: string;
  harvestEndDate: string;
}

export interface ScheduleTaskInput {
  taskType: ScheduleTaskType;
  title: string;
  scheduledDate: string;
  originalDate: string;
  sequenceOrder: number;
  cropName: string;
  varietyName: string;
  bedId?: string;
  bedName?: string;
  plantingScheduleId: string;
  isCompleted: boolean;
}

// ─── Sequence order mapping ───

const TASK_TYPE_ORDER: Record<ScheduleTaskType, number> = {
  seed_start: 0,
  bed_prep: 1,
  transplant: 2,
  cultivate: 3,
  harvest: 4,
};

// ─── Title templates ───

function taskTitle(
  taskType: ScheduleTaskType,
  cropName: string,
  varietyName: string,
): string {
  switch (taskType) {
    case "seed_start":
      return `Start ${varietyName} ${cropName} seeds indoors`;
    case "bed_prep":
      return `Prepare bed for ${varietyName} ${cropName}`;
    case "transplant":
      return `Transplant ${varietyName} ${cropName}`;
    case "cultivate":
      return `Begin cultivating ${varietyName} ${cropName}`;
    case "harvest":
      return `Harvest ${varietyName} ${cropName}`;
  }
}

// ─── Helpers ───

function toISO(date: Date): string {
  return formatISO(date, { representation: "date" });
}

// ─── Core date computation ───

export type SchedulingDateFields = {
  daysToMaturity: number;
  daysToTransplant: number | null;
  bedPrepLeadDays: number;
  harvestWindowDays: number;
  indoorStart: boolean;
  directSow: boolean;
};

export function computeTaskDates(
  variety: SchedulingDateFields,
  anchorDate: string,
  direction: "forward" | "backward",
): ComputedDates {
  const anchor = parseISO(anchorDate);

  const isTransplantable =
    variety.daysToTransplant != null && variety.indoorStart;

  if (direction === "forward") {
    if (isTransplantable) {
      // Forward from seed start date
      const seedStart = anchor;
      const transplant = addDays(seedStart, variety.daysToTransplant!);
      const bedPrep =
        variety.bedPrepLeadDays > 0
          ? addDays(transplant, -variety.bedPrepLeadDays)
          : undefined;
      const cultivateStart = addDays(transplant, 7);
      const harvestStart = addDays(transplant, variety.daysToMaturity);
      const harvestEnd = addDays(harvestStart, variety.harvestWindowDays);

      const result: ComputedDates = {
        seedStartDate: toISO(seedStart),
        transplantDate: toISO(transplant),
        cultivateStartDate: toISO(cultivateStart),
        harvestStartDate: toISO(harvestStart),
        harvestEndDate: toISO(harvestEnd),
      };
      if (bedPrep) {
        result.bedPrepDate = toISO(bedPrep);
      }
      return result;
    } else {
      // Forward from direct sow date
      const sowDate = anchor;
      const cultivateStart = addDays(sowDate, 7);
      const harvestStart = addDays(sowDate, variety.daysToMaturity);
      const harvestEnd = addDays(harvestStart, variety.harvestWindowDays);

      return {
        cultivateStartDate: toISO(cultivateStart),
        harvestStartDate: toISO(harvestStart),
        harvestEndDate: toISO(harvestEnd),
      };
    }
  } else {
    // Backward from harvest target date
    if (isTransplantable) {
      const harvestEnd = anchor;
      const harvestStart = addDays(
        harvestEnd,
        -variety.harvestWindowDays,
      );
      const transplant = addDays(harvestStart, -variety.daysToMaturity);
      const bedPrep =
        variety.bedPrepLeadDays > 0
          ? addDays(transplant, -variety.bedPrepLeadDays)
          : undefined;
      const cultivateStart = addDays(transplant, 7);
      const seedStart = addDays(transplant, -variety.daysToTransplant!);

      const result: ComputedDates = {
        seedStartDate: toISO(seedStart),
        transplantDate: toISO(transplant),
        cultivateStartDate: toISO(cultivateStart),
        harvestStartDate: toISO(harvestStart),
        harvestEndDate: toISO(harvestEnd),
      };
      if (bedPrep) {
        result.bedPrepDate = toISO(bedPrep);
      }
      return result;
    } else {
      // Backward from harvest target, direct sow only
      const harvestEnd = anchor;
      const harvestStart = addDays(
        harvestEnd,
        -variety.harvestWindowDays,
      );
      const sowDate = addDays(harvestStart, -variety.daysToMaturity);
      const cultivateStart = addDays(sowDate, 7);

      return {
        cultivateStartDate: toISO(cultivateStart),
        harvestStartDate: toISO(harvestStart),
        harvestEndDate: toISO(harvestEnd),
      };
    }
  }
}

// ─── Build task inputs from computed dates ───

export function buildTaskInputs(
  dates: ComputedDates,
  scheduleId: string,
  cropName: string,
  varietyName: string,
  bedId?: string,
  bedName?: string,
): ScheduleTaskInput[] {
  const tasks: ScheduleTaskInput[] = [];

  const addTask = (
    taskType: ScheduleTaskType,
    scheduledDate: string | undefined,
  ) => {
    if (scheduledDate == null) return;
    const task: ScheduleTaskInput = {
      taskType,
      title: taskTitle(taskType, cropName, varietyName),
      scheduledDate,
      originalDate: scheduledDate,
      sequenceOrder: TASK_TYPE_ORDER[taskType],
      cropName,
      varietyName,
      plantingScheduleId: scheduleId,
      isCompleted: false,
    };
    if (bedId) {
      task.bedId = bedId;
    }
    if (bedName) {
      task.bedName = bedName;
    }
    tasks.push(task);
  };

  addTask("seed_start", dates.seedStartDate);
  addTask("bed_prep", dates.bedPrepDate);
  addTask("transplant", dates.transplantDate);
  addTask("cultivate", dates.cultivateStartDate);
  addTask("harvest", dates.harvestStartDate);

  return tasks;
}

// ─── Rescheduling ───

export interface RescheduleUpdate {
  id: string;
  changes: { scheduledDate: string };
}

export function computeRescheduleUpdates(
  tasks: Array<{ id: string; scheduledDate: string }>,
  daysDelta: number,
): RescheduleUpdate[] {
  return tasks.map((task) => ({
    id: task.id,
    changes: {
      scheduledDate: toISO(addDays(parseISO(task.scheduledDate), daysDelta)),
    },
  }));
}

// ─── Late completion propagation ───

export function computeLateCompletionDelta(
  scheduledDate: string,
  completedDate: string,
): number {
  return differenceInCalendarDays(
    parseISO(completedDate),
    parseISO(scheduledDate),
  );
}

export function computeDownstreamUpdates(
  downstreamTasks: Array<{ id: string; scheduledDate: string }>,
  delta: number,
): RescheduleUpdate[] {
  if (delta <= 0) return [];
  return computeRescheduleUpdates(downstreamTasks, delta);
}

// ─── Updated schedule dates from tasks ───

export function computeScheduleDateUpdates(
  tasks: Array<{ taskType: ScheduleTaskType; scheduledDate: string }>,
  harvestWindowDays: number,
): Partial<ComputedDates> {
  const result: Record<string, string> = {};

  for (const task of tasks) {
    switch (task.taskType) {
      case "seed_start":
        result["seedStartDate"] = task.scheduledDate;
        break;
      case "bed_prep":
        result["bedPrepDate"] = task.scheduledDate;
        break;
      case "transplant":
        result["transplantDate"] = task.scheduledDate;
        break;
      case "cultivate":
        result["cultivateStartDate"] = task.scheduledDate;
        break;
      case "harvest":
        result["harvestStartDate"] = task.scheduledDate;
        result["harvestEndDate"] = formatISO(
          addDays(parseISO(task.scheduledDate), harvestWindowDays),
          { representation: "date" },
        );
        break;
    }
  }

  return result as Partial<ComputedDates>;
}
