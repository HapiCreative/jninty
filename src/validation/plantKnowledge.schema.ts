import { z } from "zod";
import { plantTypeSchema } from "./plantInstance.schema.ts";

export const sunExposureSchema = z.enum([
  "full_sun",
  "partial_shade",
  "full_shade",
]);

export const waterNeedsSchema = z.enum(["low", "moderate", "high"]);

export const growthRateSchema = z.enum(["slow", "moderate", "fast"]);

export const schedulingSchema = z
  .object({
    daysToTransplant: z.number().int().positive().nullable(),
    seedingDepthInches: z.number().min(0),
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

export const plantKnowledgeSchema = z
  .object({
    species: z.string().min(1),
    variety: z.string().min(1).optional(),
    commonName: z.string().min(1),
    plantType: plantTypeSchema,
    isPerennial: z.boolean(),
    cropGroup: z.string().min(1),
    family: z.string().min(1).optional(),

    // Planting timing offsets (deterministic calendar math)
    indoorStartWeeksBeforeLastFrost: z.number().int().optional(),
    transplantWeeksAfterLastFrost: z.number().int().optional(),
    directSowWeeksBeforeLastFrost: z.number().int().optional(),
    directSowWeeksAfterLastFrost: z.number().int().optional(),
    daysToGermination: z.number().int().positive().optional(),
    daysToMaturity: z.number().int().positive().optional(),

    // Care info
    spacingInches: z.number().int().positive().optional(),
    sunNeeds: sunExposureSchema,
    waterNeeds: waterNeedsSchema,
    soilPreference: z.string().min(1).optional(),
    matureHeightInches: z.number().int().positive().optional(),
    matureSpreadInches: z.number().int().positive().optional(),
    growthRate: growthRateSchema.optional(),

    // Scheduling (CropDB-merged data)
    scheduling: schedulingSchema.optional(),

    // Companion planting
    goodCompanions: z.array(z.string().min(1)).optional(),
    badCompanions: z.array(z.string().min(1)).optional(),

    // Common issues
    commonPests: z.array(z.string().min(1)).optional(),
    commonDiseases: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type PlantKnowledge = z.infer<typeof plantKnowledgeSchema>;
export type Scheduling = z.infer<typeof schedulingSchema>;
export type SunExposure = z.infer<typeof sunExposureSchema>;
export type WaterNeeds = z.infer<typeof waterNeedsSchema>;
export type GrowthRate = z.infer<typeof growthRateSchema>;
