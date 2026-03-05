import { z } from "zod";
import { baseEntitySchema, isoDate } from "./base.schema.ts";

export const scheduleDirectionSchema = z.enum(["forward", "backward"]);

export const plantingScheduleStatusSchema = z.enum([
  "active",
  "completed",
  "cancelled",
]);

export const cropSourceSchema = z.enum(["builtin", "custom"]);

export const plantingScheduleSchema = baseEntitySchema
  .extend({
    // Crop reference
    cropId: z.string().min(1),
    varietyId: z.string().min(1),
    cropSource: cropSourceSchema,

    // Denormalized crop info (snapshot at creation time for offline display)
    cropName: z.string().min(1),
    varietyName: z.string().min(1),

    // Garden placement
    bedId: z.string().uuid().optional(),
    bedName: z.string().min(1).optional(),

    // Scheduling
    anchorDate: isoDate,
    direction: scheduleDirectionSchema,
    seasonId: z.string().uuid().optional(),

    // Succession planting
    successionGroupId: z.string().uuid().optional(),
    successionIndex: z.number().int().min(0).optional(),

    // Computed date cache (denormalized from variety data at creation time)
    seedStartDate: isoDate.optional(),
    bedPrepDate: isoDate.optional(),
    transplantDate: isoDate.optional(),
    cultivateStartDate: isoDate.optional(),
    harvestStartDate: isoDate,
    harvestEndDate: isoDate,

    // Status
    status: plantingScheduleStatusSchema,
    notes: z.string().min(1).optional(),
  })
  .strict();

export type PlantingSchedule = z.infer<typeof plantingScheduleSchema>;
export type ScheduleDirection = z.infer<typeof scheduleDirectionSchema>;
export type PlantingScheduleStatus = z.infer<
  typeof plantingScheduleStatusSchema
>;
export type CropSource = z.infer<typeof cropSourceSchema>;
