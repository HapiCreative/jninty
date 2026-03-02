import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import { userPlantKnowledgeRepository } from "../db/index.ts";
import { loadAllKnowledgeItems } from "../services/knowledgeBase";
import type { PlantType } from "../types";
import type { KnowledgeSource } from "../services/knowledgeBaseTypes.ts";
import { TYPE_LABELS, ALL_TYPES } from "../constants/plantLabels";
import { SOURCE_LABELS, SUN_LABELS, WATER_LABELS } from "../constants/knowledgeLabels";
import { useDebounce } from "../hooks/useDebounce";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Input from "../components/ui/Input";
import { PlusIcon } from "../components/icons";
import Skeleton from "../components/ui/Skeleton";

// ─── Icons (page-specific) ───

function GridIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function BookPlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8" />
      <path d="M8 11h6" />
    </svg>
  );
}

// ─── Select style ───

const selectClass =
  "rounded-lg border border-brown-200 bg-cream-50 px-3 py-2 text-sm text-soil-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25";

// ─── Component ───

export default function KnowledgeBrowserPage() {
  const userEntries = usePouchQuery(() =>
    userPlantKnowledgeRepository.getAll(),
  );

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const [typeFilter, setTypeFilter] = useState<PlantType | "">("");
  const [sourceFilter, setSourceFilter] = useState<KnowledgeSource | "">("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const allItems = useMemo(
    () => loadAllKnowledgeItems(userEntries ?? []),
    [userEntries],
  );

  const filteredItems = useMemo(() => {
    let results = [...allItems];

    // Search filter (substring on commonName, species, variety)
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      results = results.filter(
        (item) =>
          item.data.commonName.toLowerCase().includes(q) ||
          item.data.species.toLowerCase().includes(q) ||
          (item.data.variety && item.data.variety.toLowerCase().includes(q)),
      );
    }

    // Type filter
    if (typeFilter) {
      results = results.filter((item) => item.data.plantType === typeFilter);
    }

    // Source filter
    if (sourceFilter) {
      results = results.filter((item) => item.source === sourceFilter);
    }

    return results;
  }, [allItems, debouncedQuery, typeFilter, sourceFilter]);

  if (userEntries === undefined) {
    return (
      <div
        className="mx-auto max-w-5xl p-4"
        role="status"
        aria-label="Loading knowledge base"
      >
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-10 w-full" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-cream-200 bg-white p-4"
            >
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
              <Skeleton className="mt-3 h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-green-800">
          Plant Knowledge
        </h1>
        <span className="text-sm text-soil-500">
          {allItems.length} {allItems.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Search bar */}
      <div className="mt-4">
        <Input
          type="search"
          placeholder="Search by name, species, or variety..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search knowledge base"
        />
      </div>

      {/* Filters + view toggle */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as PlantType | "")}
          className={selectClass}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {ALL_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        <select
          value={sourceFilter}
          onChange={(e) =>
            setSourceFilter(e.target.value as KnowledgeSource | "")
          }
          className={selectClass}
          aria-label="Filter by source"
        >
          <option value="">All sources</option>
          <option value="builtin">{SOURCE_LABELS.builtin}</option>
          <option value="custom">{SOURCE_LABELS.custom}</option>
        </select>

        <div className="ml-auto flex overflow-hidden rounded-lg border border-brown-200">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
            className={`p-2 transition-colors ${
              viewMode === "grid"
                ? "bg-green-700 text-cream-50"
                : "bg-cream-50 text-soil-700 hover:bg-cream-200"
            }`}
          >
            <GridIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-label="List view"
            className={`p-2 transition-colors ${
              viewMode === "list"
                ? "bg-green-700 text-cream-50"
                : "bg-cream-50 text-soil-700 hover:bg-cream-200"
            }`}
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Items */}
      {filteredItems.length === 0 ? (
        <div className="mt-12 text-center">
          {allItems.length === 0 ? (
            <>
              <BookPlaceholderIcon className="mx-auto h-16 w-16 text-brown-300" />
              <p className="mt-4 text-lg font-medium text-soil-700">
                No knowledge entries yet
              </p>
              <p className="mt-1 text-sm text-soil-500">
                Add a custom plant knowledge entry to get started.
              </p>
              <Link
                to="/knowledge/new"
                className="mt-4 inline-flex items-center rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-cream-50 transition-colors hover:bg-green-800"
              >
                Add Entry
              </Link>
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-soil-700">
                No entries match your filters
              </p>
              <p className="mt-1 text-sm text-soil-500">
                Try adjusting your search or filters.
              </p>
            </>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <Link key={item.id} to={`/knowledge/${item.id}`}>
              <Card className="p-4 transition-shadow hover:shadow-md">
                <p className="font-display font-semibold text-soil-900 truncate">
                  {item.data.commonName}
                </p>
                <p className="mt-0.5 text-sm text-soil-600 truncate italic">
                  {item.data.species}
                  {item.data.variety ? ` '${item.data.variety}'` : ""}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs text-soil-500">
                  <span>{SUN_LABELS[item.data.sunNeeds]}</span>
                  <span>&middot;</span>
                  <span>{WATER_LABELS[item.data.waterNeeds]} water</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge>{TYPE_LABELS[item.data.plantType]}</Badge>
                  <Badge
                    variant={
                      item.source === "builtin" ? "success" : "warning"
                    }
                  >
                    {SOURCE_LABELS[item.source]}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {filteredItems.map((item) => (
            <Link key={item.id} to={`/knowledge/${item.id}`}>
              <Card className="flex items-center gap-3 p-3 transition-shadow hover:shadow-md">
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-soil-900 truncate">
                    {item.data.commonName}
                  </p>
                  <p className="text-sm text-soil-600 truncate italic">
                    {item.data.species}
                    {item.data.variety ? ` '${item.data.variety}'` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Badge>{TYPE_LABELS[item.data.plantType]}</Badge>
                  <Badge
                    variant={
                      item.source === "builtin" ? "success" : "warning"
                    }
                  >
                    {SOURCE_LABELS[item.source]}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Floating add button */}
      <Link
        to="/knowledge/new"
        aria-label="Add knowledge entry"
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-green-700 text-cream-50 shadow-lg transition-transform hover:bg-green-800 active:scale-95 md:bottom-6"
      >
        <PlusIcon className="h-7 w-7" />
      </Link>
    </div>
  );
}
