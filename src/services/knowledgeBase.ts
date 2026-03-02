import { plantKnowledgeSchema } from "../validation/plantKnowledge.schema.ts";
import type { PlantKnowledge } from "../validation/plantKnowledge.schema.ts";
import type { UserPlantKnowledge } from "../validation/userPlantKnowledge.schema.ts";
import type { KnowledgeBaseItem } from "./knowledgeBaseTypes.ts";
import { z } from "zod";

import vegetablesData from "../../data/plants/vegetables.json";
import herbsData from "../../data/plants/herbs.json";
import fruitsData from "../../data/plants/fruits.json";
import flowersData from "../../data/plants/flowers.json";

// ─── Schema for the full JSON array ───

const plantKnowledgeArraySchema = z.array(plantKnowledgeSchema);

// ─── Module-level cache ───

let cache: PlantKnowledge[] | null = null;

// ─── Public API ───

/**
 * Loads and validates all plant knowledge JSON files.
 * Results are cached after the first call.
 * Throws if any entry fails Zod validation.
 */
export function loadKnowledgeBase(): PlantKnowledge[] {
  if (cache) return cache;

  const vegetables = plantKnowledgeArraySchema.parse(vegetablesData);
  const herbs = plantKnowledgeArraySchema.parse(herbsData);
  const fruits = plantKnowledgeArraySchema.parse(fruitsData);
  const flowers = plantKnowledgeArraySchema.parse(flowersData);

  cache = [...vegetables, ...herbs, ...fruits, ...flowers];
  return cache;
}

/**
 * Searches the knowledge base by species, variety, or common name.
 * Case-insensitive substring match.
 */
export function searchKnowledge(query: string): PlantKnowledge[] {
  const plants = loadKnowledgeBase();
  const q = query.toLowerCase();

  return plants.filter(
    (p) =>
      p.species.toLowerCase().includes(q) ||
      p.commonName.toLowerCase().includes(q) ||
      (p.variety && p.variety.toLowerCase().includes(q)),
  );
}

/**
 * Returns the first plant matching the given species exactly (case-insensitive).
 */
export function getBySpecies(species: string): PlantKnowledge | undefined {
  const plants = loadKnowledgeBase();
  const s = species.toLowerCase();
  return plants.find((p) => p.species.toLowerCase() === s);
}

/**
 * Returns companion planting data for a given species.
 */
export function getCompanions(species: string): {
  good: string[];
  bad: string[];
} {
  const plant = getBySpecies(species);
  if (!plant) return { good: [], bad: [] };
  return {
    good: plant.goodCompanions ?? [],
    bad: plant.badCompanions ?? [],
  };
}

/**
 * Clears the cached knowledge base (useful for testing).
 */
export function clearKnowledgeBaseCache(): void {
  cache = null;
}

// ─── Unified Knowledge Base API ───

/**
 * Generate a deterministic ID for a built-in knowledge entry.
 */
export function builtInEntryId(species: string, variety?: string): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const base = slug(species);
  return variety ? `builtin-${base}-${slug(variety)}` : `builtin-${base}`;
}

/**
 * Convert a UserPlantKnowledge entry into a KnowledgeBaseItem,
 * stripping base entity fields to extract just the PlantKnowledge data.
 */
function userEntryToItem(entry: UserPlantKnowledge): KnowledgeBaseItem {
  const { id, version, createdAt, updatedAt, deletedAt, ...plantData } = entry;
  void version;
  void createdAt;
  void updatedAt;
  void deletedAt;
  return {
    id,
    source: "custom",
    data: plantData as PlantKnowledge,
    userEntry: entry,
  };
}

/**
 * Merge built-in plant knowledge with user-created entries into a unified list.
 * Sorted alphabetically by commonName.
 */
export function loadAllKnowledgeItems(
  userEntries: UserPlantKnowledge[],
): KnowledgeBaseItem[] {
  const builtIn = loadKnowledgeBase();

  const builtInItems: KnowledgeBaseItem[] = builtIn.map((data) => ({
    id: builtInEntryId(data.species, data.variety),
    source: "builtin" as const,
    data,
  }));

  const customItems: KnowledgeBaseItem[] = userEntries.map(userEntryToItem);

  return [...builtInItems, ...customItems].sort((a, b) =>
    a.data.commonName.localeCompare(b.data.commonName),
  );
}

/**
 * Find a knowledge item by ID. Built-in IDs start with "builtin-",
 * custom entries are UUIDs.
 */
export function findKnowledgeItemById(
  id: string,
  userEntries: UserPlantKnowledge[],
): KnowledgeBaseItem | undefined {
  if (id.startsWith("builtin-")) {
    const builtIn = loadKnowledgeBase();
    const entry = builtIn.find(
      (p) => builtInEntryId(p.species, p.variety) === id,
    );
    if (!entry) return undefined;
    return { id, source: "builtin", data: entry };
  }

  const userEntry = userEntries.find((e) => e.id === id);
  if (!userEntry) return undefined;
  return userEntryToItem(userEntry);
}
