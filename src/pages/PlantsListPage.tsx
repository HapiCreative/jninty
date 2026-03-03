import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import { plantRepository } from "../db/index.ts";
import {
  search as searchIndex,
  loadIndex,
  rebuildIndex,
} from "../db/search";
import type { PlantType, PlantStatus } from "../types";
import {
  TYPE_LABELS,
  STATUS_LABELS,
  STATUS_VARIANT,
  ALL_TYPES,
  ALL_STATUSES,
} from "../constants/plantLabels";
import { useDebounce } from "../hooks/useDebounce";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Input from "../components/ui/Input";
import PhotoThumbnail from "../components/PhotoThumbnail";
import { PlantPlaceholderIcon, PlusIcon } from "../components/icons";
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

// ─── Select style (matching Input component) ───

const selectClass =
  "rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/25";

// ─── Component ───

export default function PlantsListPage() {
  const allPlants = usePouchQuery(() => plantRepository.getAll());
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const [typeFilter, setTypeFilter] = useState<PlantType | "">("");
  const [statusFilter, setStatusFilter] = useState<PlantStatus | "">("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [indexReady, setIndexReady] = useState(false);

  // Load or rebuild search index on mount
  useEffect(() => {
    void loadIndex().then((loaded: boolean) => {
      if (!loaded) {
        return rebuildIndex();
      }
    }).then(() => {
      setIndexReady(true);
    });
  }, []);

  const filteredPlants = useMemo(() => {
    if (!allPlants) return [];

    let results = [...allPlants];

    // Search filter using MiniSearch (debounced)
    if (debouncedQuery.trim() && indexReady) {
      const hits = searchIndex(debouncedQuery);
      const plantHitIds = new Set(
        hits.filter((h) => h.entityType === "plant").map((h) => h.id),
      );
      results = results.filter((p) => plantHitIds.has(p.id));
    }

    // Type filter
    if (typeFilter) {
      results = results.filter((p) => p.type === typeFilter);
    }

    // Status filter
    if (statusFilter) {
      results = results.filter((p) => p.status === statusFilter);
    }

    return results;
  }, [allPlants, debouncedQuery, typeFilter, statusFilter, indexReady]);

  if (allPlants === undefined) {
    return (
      <div className="mx-auto max-w-5xl p-4" role="status" aria-label="Loading plants">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-10 w-full" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border-default bg-surface-elevated">
              <Skeleton className="aspect-[3/2] w-full rounded-none" />
              <div className="p-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="mt-2 h-4 w-1/2" />
              </div>
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
        <h1 className="font-display text-2xl font-bold text-text-heading">
          Plant Inventory
        </h1>
        <span className="text-sm text-text-secondary">
          {allPlants.length} {allPlants.length === 1 ? "plant" : "plants"}
        </span>
      </div>

      {/* Search bar */}
      <div className="mt-4">
        <Input
          type="search"
          placeholder="Search plants…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search plants"
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
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as PlantStatus | "")
          }
          className={selectClass}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <div className="ml-auto flex overflow-hidden rounded-lg border border-border-strong">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
            className={`p-2 transition-colors ${
              viewMode === "grid"
                ? "bg-primary text-text-on-primary"
                : "bg-surface text-text-secondary hover:bg-surface-muted"
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
                ? "bg-primary text-text-on-primary"
                : "bg-surface text-text-secondary hover:bg-surface-muted"
            }`}
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Plant grid/list */}
      {filteredPlants.length === 0 ? (
        <div className="mt-12 text-center">
          {allPlants.length === 0 ? (
            <>
              <PlantPlaceholderIcon className="mx-auto h-16 w-16 text-text-muted" />
              <p className="mt-4 text-lg font-medium text-text-secondary">
                No plants yet
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Add your first plant to get started.
              </p>
              <Link
                to="/plants/new"
                className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-text-on-primary transition-colors hover:bg-primary-hover"
              >
                Add Plant
              </Link>
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-text-secondary">
                No plants match your filters
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Try adjusting your search or filters.
              </p>
            </>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPlants.map((plant) => {
            const photoId = plant.photoIds?.[0];
            const displayName = plant.nickname ?? plant.species;

            return (
              <Link key={plant.id} to={`/plants/${plant.id}`}>
                <Card className="overflow-hidden p-0 transition-shadow hover:shadow-md">
                  {/* Photo area */}
                  <div className="relative aspect-[3/2] bg-surface-muted">
                    {photoId ? (
                      <PhotoThumbnail
                        photoId={photoId}
                        alt={displayName}
                        className="h-full w-full"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <PlantPlaceholderIcon className="h-12 w-12 text-text-muted" />
                      </div>
                    )}
                  </div>

                  {/* Info area */}
                  <div className="p-3">
                    <p className="font-display font-semibold text-text-primary truncate">
                      {displayName}
                    </p>
                    {plant.nickname && (
                      <p className="mt-0.5 text-sm text-text-secondary truncate italic">
                        {plant.species}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge>{TYPE_LABELS[plant.type]}</Badge>
                      <Badge variant={STATUS_VARIANT[plant.status]}>
                        {STATUS_LABELS[plant.status]}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {filteredPlants.map((plant) => {
            const photoId = plant.photoIds?.[0];
            const displayName = plant.nickname ?? plant.species;

            return (
              <Link key={plant.id} to={`/plants/${plant.id}`}>
                <Card className="flex items-center gap-3 p-3 transition-shadow hover:shadow-md">
                  {/* Thumbnail */}
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                    {photoId ? (
                      <PhotoThumbnail
                        photoId={photoId}
                        alt={displayName}
                        className="h-full w-full"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <PlantPlaceholderIcon className="h-6 w-6 text-text-muted" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-semibold text-text-primary truncate">
                      {displayName}
                    </p>
                    {plant.nickname && (
                      <p className="text-sm text-text-secondary truncate italic">
                        {plant.species}
                      </p>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex shrink-0 gap-1.5">
                    <Badge>{TYPE_LABELS[plant.type]}</Badge>
                    <Badge variant={STATUS_VARIANT[plant.status]}>
                      {STATUS_LABELS[plant.status]}
                    </Badge>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Floating add button */}
      <Link
        to="/plants/new"
        aria-label="Add plant"
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-text-on-primary shadow-lg transition-transform hover:bg-primary-hover active:scale-95 md:bottom-6"
      >
        <PlusIcon className="h-7 w-7" />
      </Link>
    </div>
  );
}
