import { z } from "zod";
import { baseEntitySchema } from "./base.schema.ts";

export const customVarietySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    daysToMaturity: z.number().int().positive(),
    daysToTransplant: z.number().int().positive().nullable(),
    seedingDepthInches: z.number().positive(),
    spacingInches: z.number().positive(),
    rowSpacingInches: z.number().positive(),
    harvestWindowDays: z.number().int().positive(),
    bedPrepLeadDays: z.number().int().min(0),
    successionIntervalDays: z.number().int().positive().nullable(),
    directSow: z.boolean(),
    indoorStart: z.boolean(),
    frostHardy: z.boolean(),
    notes: z.string().min(1).optional(),
  })
  .strict();

export const customCropSchema = baseEntitySchema
  .extend({
    category: z.string().min(1),
    commonName: z.string().min(1),
    varieties: z.array(customVarietySchema).min(1),
  })
  .strict();

export type CustomVariety = z.infer<typeof customVarietySchema>;
export type CustomCrop = z.infer<typeof customCropSchema>;
