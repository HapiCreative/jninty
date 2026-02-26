import type { Planting } from "../validation/planting.schema.ts";
import type { PlantInstance } from "../validation/plantInstance.schema.ts";
import { getCompanions, loadKnowledgeBase } from "./knowledgeBase.ts";

// ─── Types ───

export interface CompanionPairing {
  plantA: { id: string; name: string };
  plantB: { id: string; name: string };
  tag: string; // the companion tag that matched (e.g. "basil")
}

export interface CompanionSuggestion {
  forPlant: { id: string; name: string };
  suggestedCompanion: string; // common name tag (e.g. "basil")
}

export interface CompanionReport {
  goodPairings: CompanionPairing[];
  badPairings: CompanionPairing[];
  suggestions: CompanionSuggestion[];
}

export type PlantTokenStatus = {
  status: "good" | "bad" | "neutral";
  messages: string[];
};

// ─── Group name expansion ───

const COMPANION_GROUP_MEMBERS: Record<string, string[]> = {
  brassicas: [
    "broccoli",
    "cabbage",
    "kale",
    "cauliflower",
    "brussels sprout",
    "kohlrabi",
    "collard",
    "bok choy",
  ],
  alliums: ["onion", "garlic", "leek", "chive", "shallot", "scallion"],
  legumes: ["bean", "pea", "lentil", "chickpea"],
  nightshades: ["tomato", "pepper", "eggplant", "potato"],
  cucurbits: ["cucumber", "squash", "melon", "pumpkin", "zucchini", "gourd"],
  "aromatic herbs": [
    "basil",
    "oregano",
    "rosemary",
    "thyme",
    "sage",
    "mint",
    "dill",
    "cilantro",
    "parsley",
  ],
};

// ─── Helpers ───

import type { PlantKnowledge } from "../validation/plantKnowledge.schema.ts";

/** Cached species-to-KB-entry index. Rebuilt when the KB cache changes. */
let speciesIndex: Map<string, PlantKnowledge> | null = null;
let speciesIndexSource: PlantKnowledge[] | null = null;

function getSpeciesIndex(): Map<string, PlantKnowledge> {
  const kb = loadKnowledgeBase();
  if (speciesIndex && speciesIndexSource === kb) return speciesIndex;
  const idx = new Map<string, PlantKnowledge>();
  for (const entry of kb) {
    const key = entry.species.toLowerCase();
    if (!idx.has(key)) {
      idx.set(key, entry);
    }
  }
  speciesIndex = idx;
  speciesIndexSource = kb;
  return idx;
}

function getDisplayName(plant: PlantInstance): string {
  return plant.nickname ?? plant.species;
}

/**
 * Checks if a companion tag matches a plant's common name.
 * Uses case-insensitive substring matching plus group-name expansion.
 */
function companionTagMatchesPlant(
  tag: string,
  plantSpecies: string,
  index: Map<string, PlantKnowledge>,
): boolean {
  const plantEntry = index.get(plantSpecies.toLowerCase());
  if (!plantEntry) return false;

  const commonNameLower = plantEntry.commonName.toLowerCase();
  const tagLower = tag.toLowerCase();

  // Direct substring match against commonName
  if (commonNameLower.includes(tagLower)) return true;

  // Group name expansion: check if the tag is a group name
  // and the plant's common name matches any group member
  const groupMembers = COMPANION_GROUP_MEMBERS[tagLower];
  if (groupMembers) {
    return groupMembers.some((member) => commonNameLower.includes(member));
  }

  return false;
}

function makePairKey(idA: string, idB: string, tag: string): string {
  const sorted = [idA, idB].sort();
  return `${sorted[0]}|${sorted[1]}|${tag}`;
}

// ─── Core analysis ───

/**
 * Analyzes companion planting relationships for all plants in a bed.
 * Returns good pairings, bad pairings (conflicts), and suggestions.
 */
export function analyzeBedCompanions(
  bedId: string,
  plantings: Planting[],
  plantsMap: Map<string, PlantInstance>,
): CompanionReport {
  const bedPlantings = plantings.filter((p) => p.bedId === bedId);

  const goodPairings: CompanionPairing[] = [];
  const badPairings: CompanionPairing[] = [];
  const suggestions: CompanionSuggestion[] = [];
  const seenPairKeys = new Set<string>();
  const index = getSpeciesIndex();

  // Build a list of plants in this bed with their species
  const bedPlants: Array<{ planting: Planting; plant: PlantInstance }> = [];
  for (const planting of bedPlantings) {
    const plant = plantsMap.get(planting.plantInstanceId);
    if (plant) {
      bedPlants.push({ planting, plant });
    }
  }

  // Check every pair of plants
  for (let i = 0; i < bedPlants.length; i++) {
    const entryA = bedPlants[i]!;
    const companionsA = getCompanions(entryA.plant.species);

    for (let j = i + 1; j < bedPlants.length; j++) {
      const entryB = bedPlants[j]!;

      // Check if B is a good companion for A
      for (const goodTag of companionsA.good) {
        if (companionTagMatchesPlant(goodTag, entryB.plant.species, index)) {
          const key = makePairKey(
            entryA.plant.id,
            entryB.plant.id,
            goodTag,
          );
          if (!seenPairKeys.has(key)) {
            seenPairKeys.add(key);
            goodPairings.push({
              plantA: {
                id: entryA.plant.id,
                name: getDisplayName(entryA.plant),
              },
              plantB: {
                id: entryB.plant.id,
                name: getDisplayName(entryB.plant),
              },
              tag: goodTag,
            });
          }
        }
      }

      // Check if B is a bad companion for A
      for (const badTag of companionsA.bad) {
        if (companionTagMatchesPlant(badTag, entryB.plant.species, index)) {
          const key = makePairKey(
            entryA.plant.id,
            entryB.plant.id,
            badTag,
          );
          if (!seenPairKeys.has(key)) {
            seenPairKeys.add(key);
            badPairings.push({
              plantA: {
                id: entryA.plant.id,
                name: getDisplayName(entryA.plant),
              },
              plantB: {
                id: entryB.plant.id,
                name: getDisplayName(entryB.plant),
              },
              tag: badTag,
            });
          }
        }
      }

      // Also check the reverse: A is a good/bad companion for B
      const companionsB = getCompanions(entryB.plant.species);

      for (const goodTag of companionsB.good) {
        if (companionTagMatchesPlant(goodTag, entryA.plant.species, index)) {
          const key = makePairKey(
            entryA.plant.id,
            entryB.plant.id,
            goodTag,
          );
          if (!seenPairKeys.has(key)) {
            seenPairKeys.add(key);
            goodPairings.push({
              plantA: {
                id: entryB.plant.id,
                name: getDisplayName(entryB.plant),
              },
              plantB: {
                id: entryA.plant.id,
                name: getDisplayName(entryA.plant),
              },
              tag: goodTag,
            });
          }
        }
      }

      for (const badTag of companionsB.bad) {
        if (companionTagMatchesPlant(badTag, entryA.plant.species, index)) {
          const key = makePairKey(
            entryA.plant.id,
            entryB.plant.id,
            badTag,
          );
          if (!seenPairKeys.has(key)) {
            seenPairKeys.add(key);
            badPairings.push({
              plantA: {
                id: entryB.plant.id,
                name: getDisplayName(entryB.plant),
              },
              plantB: {
                id: entryA.plant.id,
                name: getDisplayName(entryA.plant),
              },
              tag: badTag,
            });
          }
        }
      }
    }

    // Generate suggestions for good companions not present in the bed.
    // Only for small beds (≤3 plants) to keep suggestions actionable.
    if (bedPlants.length <= 3) {
      const bedSpeciesSet = new Set(
        bedPlants.map((bp) => bp.plant.species.toLowerCase()),
      );
      let suggestionCount = 0;

      for (const goodTag of companionsA.good) {
        if (suggestionCount >= 3) break;

        // Check if any plant in the bed already matches this tag
        const alreadyPresent = bedPlants.some((bp) =>
          companionTagMatchesPlant(goodTag, bp.plant.species, index),
        );
        if (alreadyPresent) continue;

        // Don't suggest if the tag matches the plant's own species
        if (companionTagMatchesPlant(goodTag, entryA.plant.species, index))
          continue;

        // Avoid suggesting something whose species is already in the bed
        // (the tag might match a different common name for the same species)
        const tagLower = goodTag.toLowerCase();
        let matchedKb: PlantKnowledge | undefined;
        for (const entry of index.values()) {
          if (entry.commonName.toLowerCase().includes(tagLower)) {
            matchedKb = entry;
            break;
          }
        }
        if (matchedKb && bedSpeciesSet.has(matchedKb.species.toLowerCase()))
          continue;

        suggestions.push({
          forPlant: {
            id: entryA.plant.id,
            name: getDisplayName(entryA.plant),
          },
          suggestedCompanion: goodTag,
        });
        suggestionCount++;
      }
    }
  }

  // Deduplicate suggestions (same companion tag for different plants)
  const uniqueSuggestions: CompanionSuggestion[] = [];
  const seenSuggestionTags = new Set<string>();
  for (const s of suggestions) {
    if (!seenSuggestionTags.has(s.suggestedCompanion.toLowerCase())) {
      seenSuggestionTags.add(s.suggestedCompanion.toLowerCase());
      uniqueSuggestions.push(s);
    }
  }

  return {
    goodPairings,
    badPairings,
    suggestions: uniqueSuggestions.slice(0, 3),
  };
}

/**
 * Returns per-plant companion status for token rendering.
 * Bad overrides good — a plant with both a conflict and a benefit shows "bad".
 * Accepts an optional pre-computed report to avoid redundant analysis.
 */
export function getPlantTokenStatuses(
  bedId: string,
  plantings: Planting[],
  plantsMap: Map<string, PlantInstance>,
  precomputedReport?: CompanionReport | undefined,
): Map<string, PlantTokenStatus> {
  const report =
    precomputedReport ?? analyzeBedCompanions(bedId, plantings, plantsMap);
  const statusMap = new Map<string, PlantTokenStatus>();

  // Collect messages per plant
  const plantMessages = new Map<
    string,
    { good: string[]; bad: string[] }
  >();

  function ensureEntry(id: string) {
    if (!plantMessages.has(id)) {
      plantMessages.set(id, { good: [], bad: [] });
    }
    return plantMessages.get(id)!;
  }

  for (const pairing of report.goodPairings) {
    const entryA = ensureEntry(pairing.plantA.id);
    entryA.good.push(
      `Good companion with ${pairing.plantB.name}`,
    );
    const entryB = ensureEntry(pairing.plantB.id);
    entryB.good.push(
      `Good companion with ${pairing.plantA.name}`,
    );
  }

  for (const pairing of report.badPairings) {
    const entryA = ensureEntry(pairing.plantA.id);
    entryA.bad.push(
      `Conflict with ${pairing.plantB.name}`,
    );
    const entryB = ensureEntry(pairing.plantB.id);
    entryB.bad.push(
      `Conflict with ${pairing.plantA.name}`,
    );
  }

  // Determine final status: bad overrides good
  for (const [id, msgs] of plantMessages) {
    if (msgs.bad.length > 0) {
      statusMap.set(id, {
        status: "bad",
        messages: [...msgs.bad, ...msgs.good],
      });
    } else if (msgs.good.length > 0) {
      statusMap.set(id, { status: "good", messages: msgs.good });
    }
  }

  return statusMap;
}
