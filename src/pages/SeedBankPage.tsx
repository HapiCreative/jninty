import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import { formatISO, startOfDay, differenceInDays, parseISO } from "date-fns";
import { seedRepository } from "../db/index.ts";
import type { Seed } from "../types";
import {
  QUANTITY_UNIT_LABELS,
  ALL_SEED_TYPE_FILTERS,
  SEED_TYPE_FILTER_LABELS,
  type SeedTypeFilter,
} from "../constants/seedLabels";
import { useDebounce } from "../hooks/useDebounce";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Input from "../components/ui/Input";
import { SeedIcon, PlusIcon } from "../components/icons";
import Skeleton from "../components/ui/Skeleton";

type SortKey = "name" | "species" | "expiryDate" | "quantity";

const selectClass =
  "rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/25";

function todayDate(): string {
  return formatISO(startOfDay(new Date()), { representation: "date" });
}

function getSeedStatus(seed: Seed): {
  label: string;
  variant: "default" | "success" | "warning" | "danger";
} | null {
  const today = todayDate();

  // Expired
  if (seed.expiryDate && seed.expiryDate < today) {
    return { label: "Expired", variant: "danger" };
  }

  // Expiring soon (within 30 days)
  if (seed.expiryDate) {
    const daysUntil = differenceInDays(parseISO(seed.expiryDate), new Date());
    if (daysUntil <= 30) {
      return { label: `Expires in ${String(daysUntil)}d`, variant: "warning" };
    }
  }

  // Low stock
  const isLowStock =
    (seed.quantityUnit === "count" && seed.quantityRemaining <= 5) ||
    (seed.quantityUnit === "packets" && seed.quantityRemaining <= 5) ||
    (seed.quantityUnit === "grams" && seed.quantityRemaining <= 10) ||
    (seed.quantityUnit === "ounces" && seed.quantityRemaining <= 10);

  if (isLowStock) {
    return { label: "Low Stock", variant: "default" };
  }

  return null;
}

function matchesTypeFilter(seed: Seed, filter: SeedTypeFilter): boolean {
  const name = seed.name.toLowerCase();
  const species = seed.species.toLowerCase();
  const notes = seed.notes?.toLowerCase() ?? "";

  // Simple keyword matching for seed type filtering
  const herbKeywords = ["herb", "basil", "cilantro", "parsley", "dill", "mint", "thyme", "oregano", "rosemary", "sage", "chive"];
  const flowerKeywords = ["flower", "daisy", "rose", "sunflower", "marigold", "petunia", "zinnia", "lavender", "cosmos", "poppy"];
  const vegetableKeywords = ["vegetable", "tomato", "pepper", "lettuce", "carrot", "bean", "pea", "squash", "cucumber", "corn", "radish", "onion", "potato", "beet", "broccoli", "cabbage", "spinach", "kale"];

  const text = `${name} ${species} ${notes}`;

  switch (filter) {
    case "herb":
      return herbKeywords.some((kw) => text.includes(kw));
    case "flower":
      return flowerKeywords.some((kw) => text.includes(kw));
    case "vegetable":
      return vegetableKeywords.some((kw) => text.includes(kw));
  }
}

export default function SeedBankPage() {
  const allSeeds = usePouchQuery(() => seedRepository.getAll());
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const [typeFilter, setTypeFilter] = useState<SeedTypeFilter | "">("");
  const [sortKey, setSortKey] = useState<SortKey>("name");

  const filteredSeeds = useMemo(() => {
    if (!allSeeds) return [];

    let results = [...allSeeds];

    // Search filter
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      results = results.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.species.toLowerCase().includes(q) ||
          (s.variety?.toLowerCase().includes(q) ?? false) ||
          (s.brand?.toLowerCase().includes(q) ?? false),
      );
    }

    // Type filter
    if (typeFilter) {
      results = results.filter((s) => matchesTypeFilter(s, typeFilter));
    }

    // Sort
    results.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name);
        case "species":
          return a.species.localeCompare(b.species);
        case "expiryDate": {
          const aDate = a.expiryDate ?? "9999-12-31";
          const bDate = b.expiryDate ?? "9999-12-31";
          return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
        }
        case "quantity":
          return a.quantityRemaining - b.quantityRemaining;
      }
    });

    return results;
  }, [allSeeds, debouncedQuery, typeFilter, sortKey]);

  if (allSeeds === undefined) {
    return (
      <div className="mx-auto max-w-5xl p-4" role="status" aria-label="Loading seeds">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-10 w-full" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-heading">
          Seed Bank
        </h1>
        <span className="text-sm text-text-secondary">
          {allSeeds.length} {allSeeds.length === 1 ? "seed" : "seeds"}
        </span>
      </div>

      {/* Search bar */}
      <div className="mt-4">
        <Input
          type="search"
          placeholder="Search seeds..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search seeds"
        />
      </div>

      {/* Filters + sort */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as SeedTypeFilter | "")
          }
          className={selectClass}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {ALL_SEED_TYPE_FILTERS.map((t) => (
            <option key={t} value={t}>
              {SEED_TYPE_FILTER_LABELS[t]}
            </option>
          ))}
        </select>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className={selectClass}
          aria-label="Sort by"
        >
          <option value="name">Sort: Name</option>
          <option value="species">Sort: Species</option>
          <option value="expiryDate">Sort: Expiry Date</option>
          <option value="quantity">Sort: Quantity</option>
        </select>
      </div>

      {/* Seed list */}
      {filteredSeeds.length === 0 ? (
        <div className="mt-12 text-center">
          {allSeeds.length === 0 ? (
            <>
              <SeedIcon className="mx-auto h-16 w-16 text-text-muted" />
              <p className="mt-4 text-lg font-medium text-text-secondary">
                No seeds yet
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Add your first seed packet to start tracking.
              </p>
              <Link
                to="/seeds/new"
                className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-text-on-primary transition-colors hover:bg-primary-hover"
              >
                Add Seed
              </Link>
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-text-secondary">
                No seeds match your filters
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Try adjusting your search or filters.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {filteredSeeds.map((seed) => {
            const status = getSeedStatus(seed);

            return (
              <Link key={seed.id} to={`/seeds/${seed.id}`}>
                <Card className="flex items-center gap-3 p-3 transition-shadow hover:shadow-md">
                  {/* Icon */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-50">
                    <SeedIcon className="h-6 w-6 text-text-link" />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-semibold text-text-primary truncate">
                      {seed.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-sm text-text-secondary truncate italic">
                        {seed.species}
                      </span>
                      {seed.brand && (
                        <span className="text-xs text-text-muted">
                          &middot; {seed.brand}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity + badges */}
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-medium text-text-secondary">
                      {String(seed.quantityRemaining)}{" "}
                      {QUANTITY_UNIT_LABELS[seed.quantityUnit].toLowerCase()}
                    </span>
                    {status && (
                      <Badge variant={status.variant}>{status.label}</Badge>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Floating add button */}
      <Link
        to="/seeds/new"
        aria-label="Add seed"
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-text-on-primary shadow-lg transition-transform hover:bg-primary-hover active:scale-95 md:bottom-6"
      >
        <PlusIcon className="h-7 w-7" />
      </Link>
    </div>
  );
}
