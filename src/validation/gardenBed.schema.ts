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

export const bedShapeSchema = z.enum(["rectangle"]);

export const sunExposureSchema = z.enum([
  "full_sun",
  "partial_shade",
  "full_shade",
]);

export const gardenBedSchema = baseEntitySchema
  .extend({
    name: z.string().min(1),
    type: bedTypeSchema,
    // Grid position & dimensions (in grid units)
    gridX: z.number(),
    gridY: z.number(),
    gridWidth: z.number().positive(),
    gridHeight: z.number().positive(),
    shape: bedShapeSchema,
    color: z.string().min(1),
    sunExposure: sunExposureSchema.optional(),
    soilType: z.string().min(1).optional(),
    irrigationMethod: z.string().min(1).optional(),
    notes: z.string().min(1).optional(),
  })
  .strict();

export type BedType = z.infer<typeof bedTypeSchema>;
export type BedShape = z.infer<typeof bedShapeSchema>;
export type BedSunExposure = z.infer<typeof sunExposureSchema>;
export type GardenBed = z.infer<typeof gardenBedSchema>;
