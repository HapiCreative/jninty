import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import { format, parseISO } from "date-fns";
import { seasonRepository } from "../db/index.ts";
import {
  getAllExpenseRows,
  getSpendingByCategory,
  getSpendingByStore,
  type ExpenseRow,
  type ExpenseFilters,
  type CategoryTotal,
  type StoreTotal,
} from "../services/expenseService";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_COLORS,
  ALL_EXPENSE_CATEGORIES,
} from "../constants/expenseLabels";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import StoreAutosuggest from "../components/StoreAutosuggest";
import { PlusIcon, ChevronRightIcon } from "../components/icons";
import Skeleton from "../components/ui/Skeleton";

const selectClass =
  "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/25";

const ALL_CATEGORY_LABELS: Record<string, string> = {
  ...EXPENSE_CATEGORY_LABELS,
  plants: "Plants",
  seeds: "Seeds",
};

const ALL_CATEGORY_COLORS: Record<string, string> = {
  ...EXPENSE_CATEGORY_COLORS,
  plants: "#2D5016",
  seeds: "#6b8e23",
};

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export default function ExpensesPage() {
  const seasons = usePouchQuery(() => seasonRepository.getAll());
  const activeSeason = usePouchQuery(() => seasonRepository.getActive());

  // Filters
  const [seasonId, setSeasonId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Data
  const [rows, setRows] = useState<ExpenseRow[] | null>(null);
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([]);
  const [storeTotals, setStoreTotals] = useState<StoreTotal[]>([]);

  // Default to active season
  useEffect(() => {
    if (activeSeason && !seasonId) {
      setSeasonId(activeSeason.id);
    }
  }, [activeSeason, seasonId]);

  const filters: ExpenseFilters = useMemo(() => {
    const f: ExpenseFilters = {};
    if (seasonId) f.seasonId = seasonId;
    if (startDate) f.startDate = startDate;
    if (endDate) f.endDate = endDate;
    if (storeFilter) f.store = storeFilter;
    if (selectedCategories.length > 0) f.categories = selectedCategories;
    return f;
  }, [seasonId, startDate, endDate, storeFilter, selectedCategories]);

  useEffect(() => {
    void (async () => {
      const [r, c, s] = await Promise.all([
        getAllExpenseRows(filters),
        getSpendingByCategory(filters),
        getSpendingByStore(filters),
      ]);
      setRows(r);
      setCategoryTotals(c);
      setStoreTotals(s);
    })();
  }, [filters]);

  const totalSpent = useMemo(
    () => (rows ? rows.reduce((sum, r) => sum + r.amount, 0) : 0),
    [rows],
  );

  const maxCategoryTotal = useMemo(
    () =>
      categoryTotals.length > 0
        ? Math.max(...categoryTotals.map((c) => c.total))
        : 0,
    [categoryTotals],
  );

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  if (rows === null) {
    return (
      <div
        className="mx-auto max-w-2xl space-y-4 p-4"
        role="status"
        aria-label="Loading expenses"
      >
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-heading">
          Expenses
        </h1>
        <Link to="/expenses/new">
          <Button>
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Expense
          </Button>
        </Link>
      </div>

      {/* Summary */}
      <Card className="mt-4">
        <div className="text-center">
          <p className="text-sm text-text-secondary">Total Spent</p>
          <p className="font-display text-3xl font-bold text-text-heading">
            {formatCurrency(totalSpent)}
          </p>
        </div>

        {/* Category bar chart */}
        {categoryTotals.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-medium text-text-secondary">By Category</h3>
            {categoryTotals.map((ct) => (
              <div key={ct.category} className="flex items-center gap-2">
                <span className="w-28 truncate text-xs text-text-secondary">
                  {ct.label}
                </span>
                <div className="flex-1">
                  <div
                    className="h-5 rounded"
                    style={{
                      width: `${maxCategoryTotal > 0 ? (ct.total / maxCategoryTotal) * 100 : 0}%`,
                      minWidth: "4px",
                      backgroundColor:
                        ALL_CATEGORY_COLORS[ct.category] ?? "#708090",
                    }}
                  />
                </div>
                <span className="w-16 text-right text-xs font-medium text-text-primary">
                  {formatCurrency(ct.total)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Top stores */}
        {storeTotals.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-text-secondary">Top Stores</h3>
            <div className="mt-2 space-y-1">
              {storeTotals.slice(0, 5).map((st) => (
                <div
                  key={st.store}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate text-text-secondary">{st.store}</span>
                  <span className="shrink-0 text-text-primary">
                    {formatCurrency(st.total)}{" "}
                    <span className="text-xs text-text-muted">
                      ({st.percentage}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Filter toggle */}
      <button
        type="button"
        onClick={() => setShowFilters(!showFilters)}
        className="mt-4 text-sm font-medium text-text-link hover:underline"
      >
        {showFilters ? "Hide filters" : "Show filters"}
      </button>

      {/* Filters */}
      {showFilters && (
        <Card className="mt-2">
          <div className="space-y-3">
            {/* Season */}
            <div>
              <label
                htmlFor="filter-season"
                className="mb-1 block text-xs font-medium text-text-secondary"
              >
                Season
              </label>
              <select
                id="filter-season"
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                className={selectClass}
              >
                <option value="">All seasons</option>
                {seasons?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="filter-start"
                  className="mb-1 block text-xs font-medium text-text-secondary"
                >
                  From
                </label>
                <Input
                  id="filter-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="filter-end"
                  className="mb-1 block text-xs font-medium text-text-secondary"
                >
                  To
                </label>
                <Input
                  id="filter-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Store */}
            <div>
              <label
                htmlFor="filter-store"
                className="mb-1 block text-xs font-medium text-text-secondary"
              >
                Store
              </label>
              <StoreAutosuggest
                id="filter-store"
                value={storeFilter}
                onChange={setStoreFilter}
                placeholder="Filter by store"
              />
            </div>

            {/* Categories */}
            <div>
              <span className="mb-1 block text-xs font-medium text-text-secondary">
                Categories
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ALL_EXPENSE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      selectedCategories.includes(cat)
                        ? "bg-primary text-white"
                        : "bg-surface-muted text-text-secondary hover:bg-surface-muted"
                    }`}
                  >
                    {EXPENSE_CATEGORY_LABELS[cat]}
                  </button>
                ))}
                {/* Also allow filtering by plants/seeds */}
                {(["plants", "seeds"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      selectedCategories.includes(cat)
                        ? "bg-primary text-white"
                        : "bg-surface-muted text-text-secondary hover:bg-surface-muted"
                    }`}
                  >
                    {ALL_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear filters */}
            {(seasonId || startDate || endDate || storeFilter || selectedCategories.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setSeasonId("");
                  setStartDate("");
                  setEndDate("");
                  setStoreFilter("");
                  setSelectedCategories([]);
                }}
                className="text-xs text-terracotta-600 hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Expense list */}
      <section className="mt-4">
        <h2 className="font-display text-lg font-semibold text-text-heading">
          All Expenses
        </h2>

        {rows.length === 0 ? (
          <Card className="mt-2">
            <p className="text-center text-sm text-text-secondary">
              No expenses found. Start tracking your garden spending!
            </p>
          </Card>
        ) : (
          <div className="mt-2 space-y-2">
            {rows.map((row) => {
              const content = (
                <Card
                  key={`${row.sourceType}-${row.id}`}
                  className="transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-text-primary">
                          {row.name}
                        </span>
                        <Badge>
                          {ALL_CATEGORY_LABELS[row.category] ?? row.category}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-text-secondary">
                        <span>{format(parseISO(row.date), "MMM d, yyyy")}</span>
                        {row.store && (
                          <span className="truncate">
                            &middot; {row.store}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-text-heading">
                      {formatCurrency(row.amount)}
                    </span>
                    {row.sourceLink && (
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-text-muted" />
                    )}
                  </div>
                </Card>
              );

              if (row.sourceLink) {
                return (
                  <Link
                    key={`${row.sourceType}-${row.id}`}
                    to={row.sourceLink}
                    className="block"
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <Link
                  key={`${row.sourceType}-${row.id}`}
                  to={`/expenses/${row.id}/edit`}
                  className="block"
                >
                  {content}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
