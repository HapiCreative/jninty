import MiniSearch from "minisearch";
import { plantKnowledgeSchema } from "../validation/plantKnowledge.schema.ts";
import type { PlantKnowledge } from "../validation/plantKnowledge.schema.ts";
import type { UserPlantKnowledge } from "../validation/userPlantKnowledge.schema.ts";
import type { KnowledgeBaseItem, SchedulablePlant, SpeciesGroup } from "./knowledgeBaseTypes.ts";
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

// ─── Species Grouping ───

/**
 * Generate a URL-safe slug from a species name.
 */
export function speciesSlug(species: string): string {
  return species
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Group KnowledgeBaseItems by species.
 * Returns sorted by the commonName of the first entry in each group.
 */
export function groupBySpecies(items: KnowledgeBaseItem[]): SpeciesGroup[] {
  const map = new Map<string, KnowledgeBaseItem[]>();
  for (const item of items) {
    const key = item.data.species;
    const existing = map.get(key);
    if (existing) {
      existing.push(item);
    } else {
      map.set(key, [item]);
    }
  }

  const groups: SpeciesGroup[] = [];
  for (const [species, entries] of map) {
    const first = entries[0]!;
    // Prefer the base entry (no variety) for the display name; fall back to
    // capitalising the cropGroup, which is always the clean species-level name.
    const baseEntry = entries.find((e) => !e.data.variety);
    const commonName = baseEntry
      ? baseEntry.data.commonName
      : first.data.cropGroup.charAt(0).toUpperCase() + first.data.cropGroup.slice(1);
    groups.push({
      species,
      speciesSlug: speciesSlug(species),
      commonName,
      family: first.data.family,
      entries,
    });
  }

  return groups.sort((a, b) => a.commonName.localeCompare(b.commonName));
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

// ─── Crop Group API ───

/**
 * Group all entries by cropGroup.
 */
export function getCropGroups(): Map<string, PlantKnowledge[]> {
  const plants = loadKnowledgeBase();
  const groups = new Map<string, PlantKnowledge[]>();
  for (const p of plants) {
    const existing = groups.get(p.cropGroup);
    if (existing) {
      existing.push(p);
    } else {
      groups.set(p.cropGroup, [p]);
    }
  }
  return groups;
}

/**
 * Get all entries in a specific crop group.
 */
export function getCropGroup(groupId: string): PlantKnowledge[] {
  const plants = loadKnowledgeBase();
  return plants.filter((p) => p.cropGroup === groupId);
}

/**
 * Get entries that have a scheduling block.
 */
export function getSchedulable(): SchedulablePlant[] {
  const plants = loadKnowledgeBase();
  return plants.filter(
    (p): p is SchedulablePlant => p.scheduling != null,
  );
}

/**
 * Get unique plantType values (categories) from the knowledge base.
 */
export function getCategories(): string[] {
  const plants = loadKnowledgeBase();
  const types = new Set<string>();
  for (const p of plants) {
    types.add(p.plantType);
  }
  return [...types].sort();
}

/**
 * Get entries by plantType category, grouped by cropGroup.
 */
export function getCropGroupsByCategory(
  category: string,
): Map<string, PlantKnowledge[]> {
  const plants = loadKnowledgeBase();
  const groups = new Map<string, PlantKnowledge[]>();
  for (const p of plants) {
    if (p.plantType !== category) continue;
    const existing = groups.get(p.cropGroup);
    if (existing) {
      existing.push(p);
    } else {
      groups.set(p.cropGroup, [p]);
    }
  }
  return groups;
}

/**
 * Find a plant entry by species and optional variety.
 */
export function getBySpeciesAndVariety(
  species: string,
  variety?: string,
): PlantKnowledge | undefined {
  const plants = loadKnowledgeBase();
  const s = species.toLowerCase();
  if (variety) {
    const v = variety.toLowerCase();
    return plants.find(
      (p) =>
        p.species.toLowerCase() === s &&
        p.variety?.toLowerCase() === v,
    );
  }
  return plants.find(
    (p) => p.species.toLowerCase() === s && !p.variety,
  );
}

// ─── Schedulable Plant Search ───

interface SchedulableSearchDoc {
  id: string;
  commonName: string;
  variety: string;
  cropGroup: string;
  family: string;
}

let schedulableIndex: MiniSearch<SchedulableSearchDoc> | null = null;
let schedulableMap: Map<string, SchedulablePlant> | null = null;

/**
 * Build MiniSearch index over all schedulable plants.
 * Called on first search or explicitly.
 */
export function buildSchedulableSearchIndex(): void {
  const entries = getSchedulable();

  const index = new MiniSearch<SchedulableSearchDoc>({
    fields: ["commonName", "variety", "cropGroup", "family"],
    storeFields: ["commonName", "variety", "cropGroup", "family"],
    searchOptions: {
      boost: { commonName: 2, variety: 1.5 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  const docs: SchedulableSearchDoc[] = [];
  const map = new Map<string, SchedulablePlant>();

  for (const entry of entries) {
    const id = builtInEntryId(entry.species, entry.variety);
    docs.push({
      id,
      commonName: entry.commonName,
      variety: entry.variety ?? "",
      cropGroup: entry.cropGroup,
      family: entry.family ?? "",
    });
    map.set(id, entry);
  }

  index.addAll(docs);
  schedulableIndex = index;
  schedulableMap = map;
}

export interface SchedulableSearchResult {
  id: string;
  commonName: string;
  variety: string;
  cropGroup: string;
  family: string;
  entry: SchedulablePlant;
}

/**
 * Search schedulable plants by name, variety, cropGroup, or family.
 */
export function searchSchedulable(query: string): SchedulableSearchResult[] {
  if (!query.trim()) return [];

  if (!schedulableIndex) {
    buildSchedulableSearchIndex();
  }

  const results = schedulableIndex!.search(query);

  return results
    .map((r) => {
      const entry = schedulableMap!.get(r.id);
      if (!entry) return null;
      return {
        id: r.id,
        commonName: entry.commonName,
        variety: entry.variety ?? "",
        cropGroup: entry.cropGroup,
        family: entry.family ?? "",
        entry,
      };
    })
    .filter((r): r is SchedulableSearchResult => r != null);
}

/**
 * Clear the schedulable search index (for testing or reinit).
 */
export function clearSchedulableSearchIndex(): void {
  schedulableIndex = null;
  schedulableMap = null;
}
