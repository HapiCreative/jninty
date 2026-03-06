import type {
  PlantKnowledge,
  Scheduling,
} from "../validation/plantKnowledge.schema.ts";
import type { UserPlantKnowledge } from "../validation/userPlantKnowledge.schema.ts";

export type KnowledgeSource = "builtin" | "custom";

export interface KnowledgeBaseItem {
  id: string;
  source: KnowledgeSource;
  data: PlantKnowledge;
  userEntry?: UserPlantKnowledge;
}

/** A plant knowledge entry that has a scheduling block. */
export type SchedulablePlant = PlantKnowledge & { scheduling: Scheduling };
