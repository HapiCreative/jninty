import { z } from "zod";
import { baseEntitySchema, isoDate, isoTimestamp } from "./base.schema.ts";

export const scheduleTaskTypeSchema = z.enum([
  "seed_start",
  "bed_prep",
  "transplant",
  "cultivate",
  "harvest",
]);

export const scheduleTaskSchema = baseEntitySchema
  .extend({
    // Parent reference
    plantingScheduleId: z.string().uuid(),

    // Task identity
    taskType: scheduleTaskTypeSchema,
    title: z.string().min(1),
    description: z.string().min(1).optional(),

    // Denormalized for display (avoid joins)
    cropName: z.string().min(1),
    varietyName: z.string().min(1),
    bedId: z.string().uuid().optional(),
    bedName: z.string().min(1).optional(),

    // Scheduling
    scheduledDate: isoDate,
    originalDate: isoDate,

    // Completion
    isCompleted: z.boolean(),
    completedDate: isoDate.optional(),
    completedAt: isoTimestamp.optional(),

    // Ordering within a schedule (for downstream propagation)
    sequenceOrder: z.number().int().min(0),
  })
  .strict();

export type ScheduleTask = z.infer<typeof scheduleTaskSchema>;
export type ScheduleTaskType = z.infer<typeof scheduleTaskTypeSchema>;
