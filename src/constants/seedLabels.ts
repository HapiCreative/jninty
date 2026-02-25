import type { QuantityUnit } from "../validation/seed.schema.ts";

export const QUANTITY_UNIT_LABELS: Record<QuantityUnit, string> = {
  packets: "Packets",
  grams: "Grams",
  ounces: "Ounces",
  count: "Count",
};

export const ALL_QUANTITY_UNITS: QuantityUnit[] = [
  "packets",
  "grams",
  "ounces",
  "count",
];

export const QUANTITY_UNIT_OPTIONS: { value: QuantityUnit; label: string }[] =
  ALL_QUANTITY_UNITS.map((u) => ({ value: u, label: QUANTITY_UNIT_LABELS[u] }));

/** Seed "type" filter is based on plant type values commonly associated with seeds. */
export type SeedTypeFilter = "vegetable" | "herb" | "flower";

export const SEED_TYPE_FILTER_LABELS: Record<SeedTypeFilter, string> = {
  vegetable: "Vegetable",
  herb: "Herb",
  flower: "Flower",
};

export const ALL_SEED_TYPE_FILTERS: SeedTypeFilter[] = [
  "vegetable",
  "herb",
  "flower",
];

export const SEED_TYPE_FILTER_OPTIONS: {
  value: SeedTypeFilter;
  label: string;
}[] = ALL_SEED_TYPE_FILTERS.map((t) => ({
  value: t,
  label: SEED_TYPE_FILTER_LABELS[t],
}));
