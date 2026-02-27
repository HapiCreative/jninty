import type { ExpenseCategory } from "../validation/expense.schema.ts";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  tools: "Tools",
  soil_amendments: "Soil & Amendments",
  containers: "Containers",
  infrastructure: "Infrastructure",
  fertilizer: "Fertilizer",
  pest_control: "Pest Control",
  other: "Other",
};

export const ALL_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "tools",
  "soil_amendments",
  "containers",
  "infrastructure",
  "fertilizer",
  "pest_control",
  "other",
];

export const EXPENSE_CATEGORY_OPTIONS: {
  value: ExpenseCategory;
  label: string;
}[] = ALL_EXPENSE_CATEGORIES.map((c) => ({
  value: c,
  label: EXPENSE_CATEGORY_LABELS[c],
}));

/** Colors for each category used in charts and badges. */
export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  tools: "#7d4f16",
  soil_amendments: "#6b8e23",
  containers: "#d4623a",
  infrastructure: "#4a7c59",
  fertilizer: "#b8860b",
  pest_control: "#8b4513",
  other: "#708090",
};
