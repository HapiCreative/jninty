import { baseEntitySchema } from "./base.schema.ts";
import { plantKnowledgeSchema } from "./plantKnowledge.schema.ts";
import { z } from "zod";

export const userPlantKnowledgeSchema = baseEntitySchema
  .extend(plantKnowledgeSchema.shape)
  .strict();

export type UserPlantKnowledge = z.infer<typeof userPlantKnowledgeSchema>;
