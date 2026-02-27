import { z } from "zod";
import { baseEntitySchema, isoDate } from "./base.schema.ts";

export const quantityUnitSchema = z.enum([
  "packets",
  "grams",
  "ounces",
  "count",
]);

export const seedSchema = baseEntitySchema
  .extend({
    name: z.string().min(1),
    species: z.string().min(1),
    variety: z.string().min(1).optional(),
    brand: z.string().min(1).optional(),
    supplier: z.string().min(1).optional(),
    quantityRemaining: z.number().nonnegative(),
    quantityUnit: quantityUnitSchema,
    purchaseDate: isoDate.optional(),
    expiryDate: isoDate.optional(),
    germinationRate: z.number().int().min(0).max(100).optional(),
    cost: z.number().nonnegative().optional(),
    purchaseStore: z.string().min(1).optional(),
    storageLocation: z.string().min(1).optional(),
    notes: z.string().min(1).optional(),
  })
  .strict();

export type QuantityUnit = z.infer<typeof quantityUnitSchema>;
export type Seed = z.infer<typeof seedSchema>;
