import type { PlantKnowledge } from "../validation/plantKnowledge.schema.ts";
import type { UserPlantKnowledge } from "../validation/userPlantKnowledge.schema.ts";

export type KnowledgeSource = "builtin" | "custom";

export interface KnowledgeBaseItem {
  id: string;
  source: KnowledgeSource;
  data: PlantKnowledge;
  userEntry?: UserPlantKnowledge;
}
