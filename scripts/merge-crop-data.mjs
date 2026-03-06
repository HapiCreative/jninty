/**
 * One-time migration script: merge CropDB data into PlantKB JSON files.
 *
 * For each CropDB crop+variety, find or create a matching PlantKB entry,
 * then add cropGroup, family, and scheduling block.
 * For PlantKB-only entries, derive cropGroup from commonName.
 *
 * Run: node scripts/merge-crop-data.mjs
 */
import { readFileSync, writeFileSync } from "fs";

// ─── Read source files ───

const cropdbVeg = JSON.parse(readFileSync("src/data/cropdb/vegetables.json", "utf8"));
const cropdbHerbs = JSON.parse(readFileSync("src/data/cropdb/herbs.json", "utf8"));
const cropdbFlowers = JSON.parse(readFileSync("src/data/cropdb/flowers.json", "utf8"));
const cropdbFruits = JSON.parse(readFileSync("src/data/cropdb/fruits.json", "utf8"));

const pkbVeg = JSON.parse(readFileSync("data/plants/vegetables.json", "utf8"));
const pkbHerbs = JSON.parse(readFileSync("data/plants/herbs.json", "utf8"));
const pkbFlowers = JSON.parse(readFileSync("data/plants/flowers.json", "utf8"));
const pkbFruits = JSON.parse(readFileSync("data/plants/fruits.json", "utf8"));

// ─── CropDB category → PlantKB plantType mapping ───

const CATEGORY_TO_PLANT_TYPE = {
  Vegetable: "vegetable",
  Herb: "herb",
  Flower: "flower",
  Fruit: "berry", // default for fruits; adjusted per-entry below
};

// Berry species (CropDB fruit entries that are berries not trees)
const BERRY_SPECIES = new Set(["strawberry", "blueberry", "raspberry"]);

// ─── Mapping from CropDB crop ID to PlantKB species ───

const CROP_TO_SPECIES = {
  tomato: "Solanum lycopersicum",
  pepper: "Capsicum annuum",
  lettuce: "Lactuca sativa",
  cucumber: "Cucumis sativus",
  zucchini: "Cucurbita pepo",
  carrot: "Daucus carota",
  bean: "Phaseolus vulgaris",
  pea: "Pisum sativum",
  broccoli: "Brassica oleracea var. italica",
  kale: "Brassica oleracea var. sabellica",
  spinach: "Spinacia oleracea",
  onion: "Allium cepa",
  garlic: "Allium sativum",
  corn: "Zea mays",
  potato: "Solanum tuberosum",
  basil: "Ocimum basilicum",
  cilantro: "Coriandrum sativum",
  parsley: "Petroselinum crispum",
  dill: "Anethum graveolens",
  mint: "Mentha spp.",
  rosemary: "Salvia rosmarinus",
  thyme: "Thymus vulgaris",
  sunflower: "Helianthus annuus",
  zinnia: "Zinnia elegans",
  marigold: "Tagetes spp.",
  cosmos: "Cosmos bipinnatus",
  nasturtium: "Tropaeolum majus",
  strawberry: "Fragaria × ananassa",
  blueberry: "Vaccinium corymbosum",
  raspberry: "Rubus idaeus",
};

// ─── Matching existing PlantKB entries that correspond to specific CropDB varieties ───
// Map: "species::variety" → CropDB cropId

const VARIETY_MATCHES = {
  "Solanum lycopersicum::Cherry": { cropId: "tomato", varietyId: "tomato-cherry" },
  "Solanum lycopersicum::Beefsteak": { cropId: "tomato", varietyId: "tomato-beefsteak" },
  "Solanum lycopersicum::Roma": { cropId: "tomato", varietyId: "tomato-roma" },
  "Capsicum annuum::Bell": { cropId: "pepper", varietyId: "pepper-bell" },
};

// Generic PlantKB entries (no variety) that match CropDB crops by commonName
const GENERIC_MATCHES = {
  Cucumber: "cucumber",
  Lettuce: "lettuce",
  Carrot: "carrot",
  Onion: "onion",
  Garlic: "garlic",
  Zucchini: "zucchini",
  Broccoli: "broccoli",
  Kale: "kale",
  Spinach: "spinach",
  Potato: "potato",
  Basil: "basil",
  Cilantro: "cilantro",
  Parsley: "parsley",
  Dill: "dill",
  Mint: "mint",
  Rosemary: "rosemary",
  Thyme: "thyme",
  Sunflower: "sunflower",
  Marigold: "marigold",
  Zinnia: "zinnia",
  Cosmos: "cosmos",
  Nasturtium: "nasturtium",
  Strawberry: "strawberry",
  Blueberry: "blueberry",
  Raspberry: "raspberry",
};

// Special cases: PlantKB entries with varieties that map to CropDB
const SPECIAL_MATCHES = {
  "Bush Green Beans": { cropId: "bean", varietyId: "bean-bush-green" },
  "Sugar Snap Peas": { cropId: "pea", varietyId: "pea-sugar-snap" },
  "Sweet Corn": { cropId: "corn", varietyId: "corn-sweet" },
};

// ─── Helpers ───

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildScheduling(v) {
  const result = {
    daysToTransplant: v.daysToTransplant,
    seedingDepthInches: v.seedingDepthInches,
    rowSpacingInches: v.rowSpacingInches,
    harvestWindowDays: v.harvestWindowDays,
    bedPrepLeadDays: v.bedPrepLeadDays,
    successionIntervalDays: v.successionIntervalDays,
    directSow: v.directSow,
    indoorStart: v.indoorStart,
    frostHardy: v.frostHardy,
  };
  if (v.notes && v.notes.trim()) {
    result.notes = v.notes;
  }
  return result;
}

function buildAllCropDB() {
  const all = [...cropdbVeg, ...cropdbHerbs, ...cropdbFlowers, ...cropdbFruits];
  const map = new Map();
  for (const crop of all) {
    map.set(crop.id, crop);
  }
  return map;
}

function createVarietyEntry(genericEntry, crop, variety, cropId) {
  const isVegetable = crop.category === "Vegetable";
  const isHerb = crop.category === "Herb";
  const isFlower = crop.category === "Flower";
  const isFruit = crop.category === "Fruit";

  let plantType = genericEntry.plantType;
  if (isFruit) {
    plantType = BERRY_SPECIES.has(cropId) ? "berry" : "fruit_tree";
  }

  // Build the new entry from generic, overriding variety-specific fields
  const entry = {
    species: genericEntry.species,
    variety: variety.name,
    commonName: `${variety.name} ${crop.commonName}`,
    plantType,
    isPerennial: genericEntry.isPerennial,
    cropGroup: cropId,
  };

  if (crop.family) {
    entry.family = crop.family;
  }

  // Copy timing fields from generic
  const timingFields = [
    "indoorStartWeeksBeforeLastFrost",
    "transplantWeeksAfterLastFrost",
    "directSowWeeksBeforeLastFrost",
    "directSowWeeksAfterLastFrost",
    "daysToGermination",
  ];
  for (const f of timingFields) {
    if (genericEntry[f] !== undefined) {
      entry[f] = genericEntry[f];
    }
  }

  // Use CropDB's daysToMaturity for the variety
  entry.daysToMaturity = variety.daysToMaturity;

  // Use CropDB spacingInches for the variety
  entry.spacingInches = variety.spacingInches;

  // Copy care fields from generic
  entry.sunNeeds = genericEntry.sunNeeds;
  entry.waterNeeds = genericEntry.waterNeeds;
  const careFields = [
    "soilPreference",
    "matureHeightInches",
    "matureSpreadInches",
    "growthRate",
  ];
  for (const f of careFields) {
    if (genericEntry[f] !== undefined) {
      entry[f] = genericEntry[f];
    }
  }

  // Scheduling block
  entry.scheduling = buildScheduling(variety);

  // Copy ecology fields from generic
  const ecologyFields = [
    "goodCompanions",
    "badCompanions",
    "commonPests",
    "commonDiseases",
  ];
  for (const f of ecologyFields) {
    if (genericEntry[f] !== undefined) {
      entry[f] = genericEntry[f];
    }
  }

  return entry;
}

// ─── Main merge logic ───

const cropMap = buildAllCropDB();

function mergeCategory(pkbEntries, cropdbEntries) {
  const result = [];
  const processedVarieties = new Set(); // "cropId::varietyId"
  // Track template entries for crops that have variety-specific but no generic PKB entry
  const cropTemplates = new Map(); // cropId → first matched PlantKB entry

  for (const entry of pkbEntries) {
    const key = `${entry.species}::${entry.variety || ""}`;

    // Check if this is a variety match (e.g., Cherry Tomato)
    const varMatch = VARIETY_MATCHES[key];
    if (varMatch) {
      const crop = cropMap.get(varMatch.cropId);
      const variety = crop?.varieties.find((v) => v.id === varMatch.varietyId);
      if (crop && variety) {
        const merged = { ...entry, cropGroup: varMatch.cropId };
        if (crop.family) merged.family = crop.family;
        // PlantKB values win for shared fields (daysToMaturity, spacingInches)
        merged.scheduling = buildScheduling(variety);
        result.push(reorderFields(merged));
        processedVarieties.add(`${varMatch.cropId}::${varMatch.varietyId}`);
        // Save as template for creating unmatched siblings
        if (!cropTemplates.has(varMatch.cropId)) {
          cropTemplates.set(varMatch.cropId, entry);
        }
        continue;
      }
    }

    // Check if this is a special match (e.g., Bush Green Beans, Sweet Corn)
    const specialMatch = SPECIAL_MATCHES[entry.commonName];
    if (specialMatch) {
      const crop = cropMap.get(specialMatch.cropId);
      const variety = crop?.varieties.find((v) => v.id === specialMatch.varietyId);
      if (crop && variety) {
        const merged = { ...entry, cropGroup: specialMatch.cropId };
        if (crop.family) merged.family = crop.family;
        merged.scheduling = buildScheduling(variety);
        result.push(reorderFields(merged));
        processedVarieties.add(`${specialMatch.cropId}::${specialMatch.varietyId}`);
        if (!cropTemplates.has(specialMatch.cropId)) {
          cropTemplates.set(specialMatch.cropId, entry);
        }
        continue;
      }
    }

    // Check if this is a generic match (e.g., generic Cucumber)
    const genericCropId = GENERIC_MATCHES[entry.commonName];
    if (genericCropId) {
      const crop = cropMap.get(genericCropId);
      if (crop) {
        const merged = { ...entry, cropGroup: genericCropId };
        if (crop.family) merged.family = crop.family;
        result.push(reorderFields(merged));

        // Create new entries for each CropDB variety NOT already in PlantKB
        for (const variety of crop.varieties) {
          const vid = `${genericCropId}::${variety.id}`;
          if (!processedVarieties.has(vid)) {
            const newEntry = createVarietyEntry(entry, crop, variety, genericCropId);
            result.push(reorderFields(newEntry));
            processedVarieties.add(vid);
          }
        }
        continue;
      }
    }

    // No CropDB match — derive cropGroup from commonName
    const derived = { ...entry, cropGroup: slugify(entry.commonName) };
    result.push(reorderFields(derived));
  }

  // Handle CropDB varieties that weren't matched above
  // These are varieties from crops that have variety-specific PKB entries but no generic
  for (const crop of cropdbEntries) {
    for (const variety of crop.varieties) {
      const vid = `${crop.id}::${variety.id}`;
      if (!processedVarieties.has(vid)) {
        // Use the template from the first matched variety for this crop
        let template = cropTemplates.get(crop.id);
        if (!template) {
          // Try to find any PlantKB entry with matching species
          const species = CROP_TO_SPECIES[crop.id];
          if (species) {
            template = pkbEntries.find((e) => e.species === species);
          }
        }
        if (template) {
          const newEntry = createVarietyEntry(template, crop, variety, crop.id);
          result.push(reorderFields(newEntry));
          processedVarieties.add(vid);
        } else {
          console.warn(`No template found for: ${crop.id}/${variety.name}`);
        }
      }
    }
  }

  return result;
}

function reorderFields(entry) {
  // Put fields in a sensible order matching the schema
  const ordered = {};
  const fieldOrder = [
    "species", "variety", "commonName", "plantType", "isPerennial",
    "cropGroup", "family",
    "indoorStartWeeksBeforeLastFrost", "transplantWeeksAfterLastFrost",
    "directSowWeeksBeforeLastFrost", "directSowWeeksAfterLastFrost",
    "daysToGermination", "daysToMaturity",
    "spacingInches", "sunNeeds", "waterNeeds", "soilPreference",
    "matureHeightInches", "matureSpreadInches", "growthRate",
    "scheduling",
    "goodCompanions", "badCompanions",
    "commonPests", "commonDiseases",
  ];
  for (const f of fieldOrder) {
    if (entry[f] !== undefined) {
      ordered[f] = entry[f];
    }
  }
  return ordered;
}

// ─── Run merge ───

console.log("Merging CropDB into PlantKB...");

const mergedVeg = mergeCategory(pkbVeg, cropdbVeg);
const mergedHerbs = mergeCategory(pkbHerbs, cropdbHerbs);
const mergedFlowers = mergeCategory(pkbFlowers, cropdbFlowers);
const mergedFruits = mergeCategory(pkbFruits, cropdbFruits);

console.log(`Vegetables: ${pkbVeg.length} → ${mergedVeg.length}`);
console.log(`Herbs: ${pkbHerbs.length} → ${mergedHerbs.length}`);
console.log(`Flowers: ${pkbFlowers.length} → ${mergedFlowers.length}`);
console.log(`Fruits: ${pkbFruits.length} → ${mergedFruits.length}`);

// Validate no duplicate species+variety
function checkDuplicates(entries, label) {
  const seen = new Set();
  const dupes = [];
  for (const e of entries) {
    const key = `${e.species}::${e.variety || ""}`;
    if (seen.has(key)) dupes.push(key);
    seen.add(key);
  }
  if (dupes.length > 0) {
    console.error(`DUPLICATES in ${label}:`, dupes);
    process.exit(1);
  }
}

checkDuplicates(mergedVeg, "vegetables");
checkDuplicates(mergedHerbs, "herbs");
checkDuplicates(mergedFlowers, "flowers");
checkDuplicates(mergedFruits, "fruits");

// Validate all entries have cropGroup
function checkCropGroups(entries, label) {
  const missing = entries.filter((e) => !e.cropGroup);
  if (missing.length > 0) {
    console.error(`Missing cropGroup in ${label}:`, missing.map((e) => e.commonName));
    process.exit(1);
  }
}

checkCropGroups(mergedVeg, "vegetables");
checkCropGroups(mergedHerbs, "herbs");
checkCropGroups(mergedFlowers, "flowers");
checkCropGroups(mergedFruits, "fruits");

// Write output
writeFileSync("data/plants/vegetables.json", JSON.stringify(mergedVeg, null, 2) + "\n");
writeFileSync("data/plants/herbs.json", JSON.stringify(mergedHerbs, null, 2) + "\n");
writeFileSync("data/plants/flowers.json", JSON.stringify(mergedFlowers, null, 2) + "\n");
writeFileSync("data/plants/fruits.json", JSON.stringify(mergedFruits, null, 2) + "\n");

const total = mergedVeg.length + mergedHerbs.length + mergedFlowers.length + mergedFruits.length;
console.log(`\nTotal entries: ${total}`);
console.log("Merge complete! Files written to data/plants/");
