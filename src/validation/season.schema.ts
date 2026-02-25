import { z } from "zod";
import { baseEntitySchema, isoDate } from "./base.schema.ts";

export const seasonSchema = baseEntitySchema
  .extend({
    name: z.string().min(1),
    year: z.number().int().positive(),
    startDate: isoDate,
    endDate: isoDate,
    isActive: z.boolean(),
  })
  .strict();

export type Season = z.infer<typeof seasonSchema>;
