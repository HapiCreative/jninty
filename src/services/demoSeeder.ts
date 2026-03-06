import { addDays, subDays, formatISO, startOfDay } from "date-fns";
import {
  seasonRepository,
  plantRepository,
  journalRepository,
  taskRepository,
  seedRepository,
  gardenBedRepository,
  expenseRepository,
  settingsRepository,
  plantingRepository,
  destroyAndRecreate,
} from "../db/index.ts";
import { destroyAndRecreateOriginals } from "../db/pouchdb/originalsStore.ts";
import { rebuildIndex } from "../db/search.ts";

function toDateStr(d: Date): string {
  return formatISO(startOfDay(d), { representation: "date" });
}

/**
 * Seeds the database with realistic demo data for screenshots.
 * Uses repository create functions so all validation, ID generation,
 * timestamps, and search indexing happen automatically.
 */
export async function loadDemoData(): Promise<void> {
  const today = new Date();

  // ── Settings ──
  await settingsRepository.update({
    gardenName: "Sunny Acres Garden",
    growingZone: "7b",
    lastFrostDate: "2026-04-15",
    firstFrostDate: "2026-10-15",
    gridUnit: "feet",
    temperatureUnit: "fahrenheit",
    theme: "light",
    keepOriginalPhotos: false,
    dbSchemaVersion: 7,
    exportVersion: 1,
  });

  // ── Season ──
  const season = await seasonRepository.create({
    name: "Spring 2026",
    year: 2026,
    startDate: "2026-03-01",
    endDate: "2026-08-31",
    isActive: true,
  });

  // ── Garden Beds ──
  const beds = await Promise.all([
    gardenBedRepository.create({
      name: "Raised Bed A",
      type: "vegetable_bed",
      gridX: 1,
      gridY: 1,
      gridWidth: 4,
      gridHeight: 8,
      shape: "rectangle",
      color: "#8B7355",
      sunExposure: "full_sun",
    }),
    gardenBedRepository.create({
      name: "Raised Bed B",
      type: "vegetable_bed",
      gridX: 6,
      gridY: 1,
      gridWidth: 4,
      gridHeight: 8,
      shape: "rectangle",
      color: "#8B7355",
      sunExposure: "full_sun",
    }),
    gardenBedRepository.create({
      name: "Herb Spiral",
      type: "herb_garden",
      gridX: 1,
      gridY: 10,
      gridWidth: 3,
      gridHeight: 3,
      shape: "rectangle",
      color: "#6B8E23",
      sunExposure: "full_sun",
    }),
    gardenBedRepository.create({
      name: "Flower Border",
      type: "flower_bed",
      gridX: 11,
      gridY: 1,
      gridWidth: 2,
      gridHeight: 10,
      shape: "rectangle",
      color: "#DA70D6",
      sunExposure: "partial_shade",
    }),
    gardenBedRepository.create({
      name: "Patio Containers",
      type: "container",
      gridX: 5,
      gridY: 10,
      gridWidth: 3,
      gridHeight: 2,
      shape: "rectangle",
      color: "#CD853F",
      sunExposure: "full_sun",
    }),
  ]);

  const [raisedA, raisedB, herbSpiral, flowerBorder, patioContainers] = beds;

  // ── Plants ──
  const plants = await Promise.all([
    plantRepository.create({
      nickname: "Sweet 100 Cherry Tomato",
      species: "Solanum lycopersicum",
      variety: "Sweet 100",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: ["tomato", "raised-bed"],
      dateAcquired: "2026-02-15",
    }),
    plantRepository.create({
      nickname: "Genovese Basil",
      species: "Ocimum basilicum",
      variety: "Genovese",
      type: "herb",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: ["culinary", "companion"],
      dateAcquired: "2026-02-20",
    }),
    plantRepository.create({
      nickname: "San Marzano Tomato",
      species: "Solanum lycopersicum",
      variety: "San Marzano",
      type: "vegetable",
      isPerennial: false,
      source: "nursery",
      status: "active",
      tags: ["tomato", "sauce"],
      dateAcquired: "2026-03-01",
      purchasePrice: 4.99,
      purchaseStore: "Green Thumb Nursery",
    }),
    plantRepository.create({
      nickname: "Jalapeño Pepper",
      species: "Capsicum annuum",
      variety: "Jalapeño",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: ["hot-pepper"],
      dateAcquired: "2026-02-15",
    }),
    plantRepository.create({
      nickname: "Buttercrunch Lettuce",
      species: "Lactuca sativa",
      variety: "Buttercrunch",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "harvested",
      tags: ["salad-green"],
      dateAcquired: "2026-02-10",
    }),
    plantRepository.create({
      nickname: "Mammoth Sunflower",
      species: "Helianthus annuus",
      variety: "Mammoth",
      type: "flower",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: ["pollinator"],
      dateAcquired: "2026-02-20",
    }),
    plantRepository.create({
      nickname: "Rosemary",
      species: "Salvia rosmarinus",
      type: "herb",
      isPerennial: true,
      source: "nursery",
      status: "active",
      tags: ["perennial", "culinary"],
      dateAcquired: "2026-03-01",
      purchasePrice: 6.99,
      purchaseStore: "Green Thumb Nursery",
    }),
    plantRepository.create({
      nickname: "Sugar Snap Pea",
      species: "Pisum sativum",
      variety: "Sugar Snap",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: ["spring-crop"],
      dateAcquired: "2026-02-10",
    }),
    plantRepository.create({
      nickname: "Black Beauty Zucchini",
      species: "Cucurbita pepo",
      variety: "Black Beauty",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: ["summer-squash"],
      dateAcquired: "2026-02-20",
    }),
    plantRepository.create({
      nickname: "French Marigold",
      species: "Tagetes patula",
      variety: "French",
      type: "flower",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: ["companion", "pest-control"],
      dateAcquired: "2026-02-15",
    }),
  ]);

  const [
    cherryTomato,
    basil,
    sanMarzano,
    jalapeno,
    lettuce,
    sunflower,
    rosemary,
    sugarSnap,
    zucchini,
    marigold,
  ] = plants;

  // ── Plantings (link plants to season + beds) ──
  await Promise.all([
    plantingRepository.create({ plantInstanceId: cherryTomato!.id, seasonId: season.id, bedId: raisedA!.id, datePlanted: "2026-02-20" }),
    plantingRepository.create({ plantInstanceId: sanMarzano!.id, seasonId: season.id, bedId: raisedA!.id, datePlanted: "2026-03-01" }),
    plantingRepository.create({ plantInstanceId: jalapeno!.id, seasonId: season.id, bedId: raisedB!.id, datePlanted: "2026-02-20" }),
    plantingRepository.create({ plantInstanceId: lettuce!.id, seasonId: season.id, bedId: raisedB!.id, datePlanted: "2026-02-10" }),
    plantingRepository.create({ plantInstanceId: zucchini!.id, seasonId: season.id, bedId: raisedB!.id, datePlanted: "2026-02-25" }),
    plantingRepository.create({ plantInstanceId: basil!.id, seasonId: season.id, bedId: herbSpiral!.id, datePlanted: "2026-02-25" }),
    plantingRepository.create({ plantInstanceId: rosemary!.id, seasonId: season.id, bedId: herbSpiral!.id, datePlanted: "2026-03-01" }),
    plantingRepository.create({ plantInstanceId: sunflower!.id, seasonId: season.id, bedId: flowerBorder!.id, datePlanted: "2026-02-20" }),
    plantingRepository.create({ plantInstanceId: marigold!.id, seasonId: season.id, bedId: flowerBorder!.id, datePlanted: "2026-02-20" }),
    plantingRepository.create({ plantInstanceId: sugarSnap!.id, seasonId: season.id, bedId: patioContainers!.id, datePlanted: "2026-02-15" }),
  ]);

  // ── Journal Entries (spread over last ~3 weeks) ──
  await Promise.all([
    journalRepository.create({
      seasonId: season.id,
      activityType: "transplant",
      title: "Transplanted tomatoes to Raised Bed A",
      body: "Moved Sweet 100 and San Marzano seedlings into Raised Bed A. Soil temp was warm enough. Added a handful of compost to each hole.",
      plantInstanceId: cherryTomato!.id,
      bedId: raisedA!.id,
      photoIds: [],
      isMilestone: false,
    }),
    journalRepository.create({
      seasonId: season.id,
      activityType: "milestone",
      title: "First sprout on Sugar Snap Peas",
      body: "Spotted the first tiny shoots poking through the soil this morning. Only 8 days since sowing — right on schedule!",
      plantInstanceId: sugarSnap!.id,
      milestoneType: "first_sprout",
      photoIds: [],
      isMilestone: true,
    }),
    journalRepository.create({
      seasonId: season.id,
      activityType: "watering",
      title: "Watered garden beds",
      body: "Deep watered all raised beds and the herb spiral. Soil was dry 2 inches down.",
      photoIds: [],
      isMilestone: false,
    }),
    journalRepository.create({
      seasonId: season.id,
      activityType: "fertilizing",
      title: "Fertilized tomatoes with fish emulsion",
      body: "Applied diluted fish emulsion (2 tbsp per gallon) to both tomato plants. They're looking a bit pale — should green up in a few days.",
      plantInstanceId: cherryTomato!.id,
      photoIds: [],
      isMilestone: false,
    }),
    journalRepository.create({
      seasonId: season.id,
      activityType: "pest",
      title: "Spotted aphids on lettuce, applied neem oil",
      body: "Found a cluster of green aphids on the underside of Buttercrunch leaves. Sprayed with neem oil solution. Will check again in 3 days.",
      plantInstanceId: lettuce!.id,
      photoIds: [],
      isMilestone: false,
    }),
    journalRepository.create({
      seasonId: season.id,
      activityType: "pruning",
      title: "Pruned basil for bushier growth",
      body: "Pinched the top sets of leaves on all basil plants to encourage lateral branching. Used the clippings in tonight's pasta!",
      plantInstanceId: basil!.id,
      photoIds: [],
      isMilestone: false,
    }),
    journalRepository.create({
      seasonId: season.id,
      activityType: "harvest",
      title: "Harvested first batch of lettuce",
      body: "Cut-and-come-again harvest of outer Buttercrunch leaves. Enough for a big salad. Leaves are tender and sweet.",
      plantInstanceId: lettuce!.id,
      harvestWeight: 0.5,
      photoIds: [],
      isMilestone: true,
      milestoneType: "peak_harvest",
    }),
    journalRepository.create({
      seasonId: season.id,
      activityType: "general",
      title: "Sunflowers reaching 60cm tall",
      body: "The Mammoth sunflowers are growing fast — tallest one is about 60cm now. Stems are thick and sturdy. Should start flowering in a few weeks.",
      plantInstanceId: sunflower!.id,
      photoIds: [],
      isMilestone: false,
    }),
  ]);

  // ── Tasks ──
  const yesterdayStr = toDateStr(subDays(today, 1));
  const threeDaysAgoStr = toDateStr(subDays(today, 3));
  const fiveDaysAgoStr = toDateStr(subDays(today, 5));
  const twoDaysFromNow = toDateStr(addDays(today, 2));
  const threeDaysFromNow = toDateStr(addDays(today, 3));
  const fourDaysFromNow = toDateStr(addDays(today, 4));
  const fiveDaysFromNow = toDateStr(addDays(today, 5));
  const oneWeekFromNow = toDateStr(addDays(today, 7));

  // Completed tasks
  const stakeTask = await taskRepository.create({
    title: "Stake tomato plants",
    dueDate: fiveDaysAgoStr,
    priority: "urgent",
    isCompleted: false,
    plantInstanceId: cherryTomato!.id,
    seasonId: season.id,
  });
  await taskRepository.complete(stakeTask.id);

  const harvestTask = await taskRepository.create({
    title: "Harvest mature lettuce",
    dueDate: threeDaysAgoStr,
    priority: "normal",
    isCompleted: false,
    plantInstanceId: lettuce!.id,
    seasonId: season.id,
  });
  await taskRepository.complete(harvestTask.id);

  // Overdue task
  await taskRepository.create({
    title: "Water garden beds",
    dueDate: yesterdayStr,
    priority: "normal",
    isCompleted: false,
    seasonId: season.id,
  });

  // Upcoming tasks
  await Promise.all([
    taskRepository.create({
      title: "Side-dress tomatoes with compost",
      dueDate: twoDaysFromNow,
      priority: "normal",
      isCompleted: false,
      plantInstanceId: cherryTomato!.id,
      seasonId: season.id,
    }),
    taskRepository.create({
      title: "Check peas for powdery mildew",
      dueDate: threeDaysFromNow,
      priority: "low",
      isCompleted: false,
      plantInstanceId: sugarSnap!.id,
      seasonId: season.id,
    }),
    taskRepository.create({
      title: "Thin zucchini seedlings",
      dueDate: fiveDaysFromNow,
      priority: "normal",
      isCompleted: false,
      plantInstanceId: zucchini!.id,
      seasonId: season.id,
    }),
    taskRepository.create({
      title: "Sow succession lettuce",
      dueDate: oneWeekFromNow,
      priority: "low",
      isCompleted: false,
      seasonId: season.id,
    }),
    taskRepository.create({
      title: "Deadhead marigolds",
      dueDate: fourDaysFromNow,
      priority: "low",
      isCompleted: false,
      plantInstanceId: marigold!.id,
      seasonId: season.id,
    }),
  ]);

  // ── Seeds ──
  await Promise.all([
    seedRepository.create({
      name: "Cherry Tomato – Sweet 100",
      species: "Solanum lycopersicum",
      variety: "Sweet 100",
      quantityRemaining: 2,
      quantityUnit: "packets",
      brand: "Burpee",
      purchaseDate: "2026-01-15",
    }),
    seedRepository.create({
      name: "Genovese Basil",
      species: "Ocimum basilicum",
      variety: "Genovese",
      quantityRemaining: 1,
      quantityUnit: "packets",
      brand: "Johnny's Seeds",
      purchaseDate: "2026-01-15",
    }),
    seedRepository.create({
      name: "Jalapeño Pepper",
      species: "Capsicum annuum",
      variety: "Jalapeño",
      quantityRemaining: 3,
      quantityUnit: "packets",
      brand: "Seed Savers",
      purchaseDate: "2026-01-20",
    }),
    seedRepository.create({
      name: "Buttercrunch Lettuce",
      species: "Lactuca sativa",
      variety: "Buttercrunch",
      quantityRemaining: 50,
      quantityUnit: "count",
      brand: "Baker Creek",
      purchaseDate: "2026-01-10",
    }),
    seedRepository.create({
      name: "Sugar Snap Pea",
      species: "Pisum sativum",
      variety: "Sugar Snap",
      quantityRemaining: 30,
      quantityUnit: "count",
      brand: "Territorial Seed",
      purchaseDate: "2026-01-10",
    }),
    seedRepository.create({
      name: "French Marigold",
      species: "Tagetes patula",
      variety: "French",
      quantityRemaining: 1,
      quantityUnit: "packets",
      brand: "Botanical Interests",
      purchaseDate: "2026-02-01",
    }),
  ]);

  // ── Expenses ──
  await Promise.all([
    expenseRepository.create({
      name: "Raised bed cedar lumber",
      category: "infrastructure",
      amount: 89.99,
      date: "2026-02-15",
      seasonId: season.id,
    }),
    expenseRepository.create({
      name: "Seed starter mix (2 bags)",
      category: "soil_amendments",
      amount: 24.5,
      date: "2026-02-20",
      seasonId: season.id,
    }),
    expenseRepository.create({
      name: "Tomato cages (4-pack)",
      category: "tools",
      amount: 32.0,
      date: "2026-03-01",
      seasonId: season.id,
    }),
    expenseRepository.create({
      name: "Fish emulsion fertilizer",
      category: "fertilizer",
      amount: 12.99,
      date: "2026-03-01",
      seasonId: season.id,
    }),
    expenseRepository.create({
      name: "Neem oil spray",
      category: "pest_control",
      amount: 9.99,
      date: "2026-03-03",
      seasonId: season.id,
    }),
  ]);

  // Rebuild search index so demo data is searchable
  await rebuildIndex();
}

/**
 * Wipes all data by destroying and recreating the database.
 * Same pattern as "Replace" import.
 */
export async function clearDemoData(): Promise<void> {
  await destroyAndRecreate();
  await destroyAndRecreateOriginals();
}
