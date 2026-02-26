import { z } from "zod";
import { baseEntitySchema } from "./base.schema.ts";

const blobSchema = z.instanceof(Blob);

export const photoSchema = baseEntitySchema
  .extend({
    thumbnailBlob: blobSchema,
    displayBlob: blobSchema.optional(),
    displayStoredInOpfs: z.boolean().optional(),
    originalStored: z.boolean(),
    caption: z.string().min(1).optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .strict();

export type Photo = z.infer<typeof photoSchema>;
