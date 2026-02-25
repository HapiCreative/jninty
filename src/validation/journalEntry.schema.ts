import { z } from "zod";
import { baseEntitySchema } from "./base.schema.ts";

export const activityTypeSchema = z.enum([
  "watering",
  "fertilizing",
  "pruning",
  "pest",
  "disease",
  "harvest",
  "transplant",
  "milestone",
  "general",
]);

export const milestoneTypeSchema = z.enum([
  "first_sprout",
  "first_flower",
  "first_fruit",
  "peak_harvest",
  "other",
]);

export const weatherSnapshotSchema = z
  .object({
    tempC: z.number().optional(),
    humidity: z.number().min(0).max(100).optional(),
    conditions: z.string().min(1).optional(),
  })
  .strict();

export const journalEntrySchema = baseEntitySchema
  .extend({
    plantInstanceId: z.string().uuid().optional(),
    bedId: z.string().uuid().optional(),
    seasonId: z.string().uuid(),
    activityType: activityTypeSchema,
    title: z.string().min(1).optional(),
    body: z.string(),
    photoIds: z.array(z.string().uuid()),
    isMilestone: z.boolean(),
    milestoneType: milestoneTypeSchema.optional(),
    harvestWeight: z.number().nonnegative().optional(),
    weatherSnapshot: weatherSnapshotSchema.optional(),
  })
  .strict();

export type ActivityType = z.infer<typeof activityTypeSchema>;
export type MilestoneType = z.infer<typeof milestoneTypeSchema>;
export type WeatherSnapshot = z.infer<typeof weatherSnapshotSchema>;
export type JournalEntry = z.infer<typeof journalEntrySchema>;
