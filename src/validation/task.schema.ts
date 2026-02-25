import { z } from "zod";
import { baseEntitySchema, isoDate, isoTimestamp } from "./base.schema.ts";

export const taskPrioritySchema = z.enum(["urgent", "normal", "low"]);

export const recurrenceTypeSchema = z.enum([
  "daily",
  "weekly",
  "monthly",
  "custom",
]);

export const recurrenceSchema = z
  .object({
    type: recurrenceTypeSchema,
    interval: z.number().int().positive(),
  })
  .strict();

export const taskSchema = baseEntitySchema
  .extend({
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    plantInstanceId: z.string().uuid().optional(),
    bedId: z.string().uuid().optional(),
    dueDate: isoDate,
    priority: taskPrioritySchema,
    isCompleted: z.boolean(),
    completedAt: isoTimestamp.optional(),
    recurrence: recurrenceSchema.optional(),
  })
  .strict();

export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type RecurrenceType = z.infer<typeof recurrenceTypeSchema>;
export type Task = z.infer<typeof taskSchema>;
