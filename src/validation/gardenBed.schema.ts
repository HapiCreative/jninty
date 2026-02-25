import { z } from "zod";
import { baseEntitySchema } from "./base.schema.ts";

export const bedTypeSchema = z.enum([
  "vegetable_bed",
  "flower_bed",
  "fruit_area",
  "herb_garden",
  "container",
  "other",
]);

export const gardenBedSchema = baseEntitySchema
  .extend({
    name: z.string().min(1),
    type: bedTypeSchema,
  })
  .strict();

export type BedType = z.infer<typeof bedTypeSchema>;
export type GardenBed = z.infer<typeof gardenBedSchema>;
