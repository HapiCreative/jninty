import { z } from "zod";

export const settingsSchema = z
  .object({
    growingZone: z.string().min(1),
    lastFrostDate: z.string().date(),
    firstFrostDate: z.string().date(),
    temperatureUnit: z.enum(["fahrenheit", "celsius"]),
    gardenName: z.string().min(1).optional(),
    theme: z.enum(["light", "dark", "auto"]),
    keepOriginalPhotos: z.boolean(),
    dbSchemaVersion: z.number().int().positive(),
    exportVersion: z.number().int().positive(),
  })
  .strict();

export type Settings = z.infer<typeof settingsSchema>;
