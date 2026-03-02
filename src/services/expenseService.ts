import { expenseRepository, plantRepository, seedRepository } from "../db/index.ts";
import { EXPENSE_CATEGORY_LABELS } from "../constants/expenseLabels.ts";
import type { ExpenseCategory } from "../validation/expense.schema.ts";

/** A unified row representing any garden expense. */
export interface ExpenseRow {
  id: string;
  name: string;
  category: ExpenseCategory | "plants" | "seeds";
  amount: number;
  store: string | undefined;
  date: string;
  /** If this row came from a plant or seed, link to its detail page. */
  sourceLink?: string;
  /** "expense" | "plant" | "seed" */
  sourceType: "expense" | "plant" | "seed";
}

export interface ExpenseFilters {
  seasonId?: string;
  startDate?: string;
  endDate?: string;
  store?: string;
  categories?: string[];
}

function matchesFilters(row: ExpenseRow, filters: ExpenseFilters): boolean {
  if (filters.startDate && row.date < filters.startDate) return false;
  if (filters.endDate && row.date > filters.endDate) return false;
  if (
    filters.store &&
    (!row.store || !row.store.toLowerCase().includes(filters.store.toLowerCase()))
  ) {
    return false;
  }
  if (
    filters.categories &&
    filters.categories.length > 0 &&
    !filters.categories.includes(row.category)
  ) {
    return false;
  }
  return true;
}

export async function getAllExpenseRows(
  filters: ExpenseFilters = {},
): Promise<ExpenseRow[]> {
  const [expenses, plants, seeds] = await Promise.all([
    filters.seasonId
      ? expenseRepository.getBySeason(filters.seasonId)
      : expenseRepository.getAll(),
    plantRepository.getAll(),
    seedRepository.getAll(),
  ]);

  const rows: ExpenseRow[] = [];

  for (const e of expenses) {
    rows.push({
      id: e.id,
      name: e.name,
      category: e.category,
      amount: e.amount,
      store: e.store,
      date: e.date,
      sourceType: "expense",
    });
  }

  for (const p of plants) {
    if (p.purchasePrice != null && p.purchasePrice > 0) {
      rows.push({
        id: p.id,
        name: p.nickname ?? p.species,
        category: "plants",
        amount: p.purchasePrice,
        store: p.purchaseStore,
        date: p.dateAcquired ?? p.createdAt.split("T")[0]!,
        sourceLink: `/plants/${p.id}`,
        sourceType: "plant",
      });
    }
  }

  for (const s of seeds) {
    if (s.cost != null && s.cost > 0) {
      rows.push({
        id: s.id,
        name: s.name,
        category: "seeds",
        amount: s.cost,
        store: s.purchaseStore,
        date: s.purchaseDate ?? s.createdAt.split("T")[0]!,
        sourceLink: `/seeds/${s.id}`,
        sourceType: "seed",
      });
    }
  }

  const filtered = rows.filter((r) => matchesFilters(r, filters));
  filtered.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
  return filtered;
}

export async function getTotalSpent(
  filters: ExpenseFilters = {},
): Promise<number> {
  const rows = await getAllExpenseRows(filters);
  return rows.reduce((sum, r) => sum + r.amount, 0);
}

export interface CategoryTotal {
  category: string;
  label: string;
  total: number;
}

export async function getSpendingByCategory(
  filters: ExpenseFilters = {},
): Promise<CategoryTotal[]> {
  const rows = await getAllExpenseRows(filters);
  const map = new Map<string, number>();

  for (const r of rows) {
    map.set(r.category, (map.get(r.category) ?? 0) + r.amount);
  }

  const allLabels: Record<string, string> = {
    ...EXPENSE_CATEGORY_LABELS,
    plants: "Plants",
    seeds: "Seeds",
  };

  const result: CategoryTotal[] = [];
  for (const [category, total] of map) {
    result.push({
      category,
      label: allLabels[category] ?? category,
      total,
    });
  }

  result.sort((a, b) => b.total - a.total);
  return result;
}

export interface StoreTotal {
  store: string;
  total: number;
  percentage: number;
}

export async function getSpendingByStore(
  filters: ExpenseFilters = {},
): Promise<StoreTotal[]> {
  const rows = await getAllExpenseRows(filters);
  const map = new Map<string, number>();
  let grandTotal = 0;

  for (const r of rows) {
    if (r.store) {
      map.set(r.store, (map.get(r.store) ?? 0) + r.amount);
    }
    grandTotal += r.amount;
  }

  const result: StoreTotal[] = [];
  for (const [store, total] of map) {
    result.push({
      store,
      total,
      percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0,
    });
  }

  result.sort((a, b) => b.total - a.total);
  return result;
}

export async function getAllStoreNames(): Promise<string[]> {
  const [expenses, plants, seeds] = await Promise.all([
    expenseRepository.getAll(),
    plantRepository.getAll(),
    seedRepository.getAll(),
  ]);

  const stores = new Set<string>();

  for (const e of expenses) {
    if (e.store) stores.add(e.store);
  }
  for (const p of plants) {
    if (p.purchaseStore) stores.add(p.purchaseStore);
  }
  for (const s of seeds) {
    if (s.purchaseStore) stores.add(s.purchaseStore);
  }

  return Array.from(stores).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
}
