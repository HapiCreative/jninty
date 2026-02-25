import { z } from "zod";
import { baseEntitySchema, isoDate } from "./base.schema.ts";

export const plantingOutcomeSchema = z.enum([
  "thrived",
  "ok",
  "failed",
  "unknown",
]);

export const plantingSchema = baseEntitySchema
  .extend({
    plantInstanceId: z.string().uuid(),
    seasonId: z.string().uuid(),
    bedId: z.string().uuid().optional(),
    datePlanted: isoDate.optional(),
    dateRemoved: isoDate.optional(),
    outcome: plantingOutcomeSchema.optional(),
    notes: z.string().min(1).optional(),
  })
  .strict();

export type PlantingOutcome = z.infer<typeof plantingOutcomeSchema>;
export type Planting = z.infer<typeof plantingSchema>;
