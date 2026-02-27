import { z } from "zod";
import { baseEntitySchema, isoDate } from "./base.schema.ts";

export const plantTypeSchema = z.enum([
  "vegetable",
  "herb",
  "flower",
  "ornamental",
  "fruit_tree",
  "berry",
  "other",
]);

export const plantSourceSchema = z.enum([
  "seed",
  "nursery",
  "cutting",
  "gift",
  "unknown",
]);

export const plantStatusSchema = z.enum([
  "active",
  "dormant",
  "harvested",
  "removed",
  "dead",
]);

export const plantInstanceSchema = baseEntitySchema
  .extend({
    nickname: z.string().min(1).optional(),
    species: z.string().min(1),
    variety: z.string().min(1).optional(),
    type: plantTypeSchema,
    isPerennial: z.boolean(),
    dateAcquired: isoDate.optional(),
    source: plantSourceSchema,
    seedId: z.string().uuid().optional(),
    status: plantStatusSchema,
    tags: z.array(z.string().min(1)),
    careNotes: z.string().min(1).optional(),
    photoIds: z.array(z.string().uuid()).optional(),
    purchasePrice: z.number().nonnegative().optional(),
    purchaseStore: z.string().min(1).optional(),
  })
  .strict();

export type PlantType = z.infer<typeof plantTypeSchema>;
export type PlantSource = z.infer<typeof plantSourceSchema>;
export type PlantStatus = z.infer<typeof plantStatusSchema>;
export type PlantInstance = z.infer<typeof plantInstanceSchema>;
