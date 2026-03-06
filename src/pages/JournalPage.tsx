import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { formatDistanceToNow, startOfWeek, startOfMonth } from "date-fns";
import { journalRepository, plantRepository, photoRepository, seasonRepository } from "../db/index.ts";
import { removeFromIndex, serializeIndex } from "../db/search";
import {
  search as searchIndex,
  loadIndex,
  rebuildIndex,
} from "../db/search";
import type { ActivityType, JournalEntry } from "../types";
import {
  ACTIVITY_LABELS,
  ALL_ACTIVITY_TYPES,
} from "../constants/plantLabels";
import { useDebounce } from "../hooks/useDebounce";
import { useSettings } from "../hooks/useSettings";
import { useToast } from "../components/ui/Toast";
import { formatTemp } from "../services/weather";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Card from "../components/ui/Card";
import PhotoThumbnail from "../components/PhotoThumbnail";
import { PlusIcon, CloseIcon, ClipboardCheckIcon } from "../components/icons";
import Skeleton from "../components/ui/Skeleton";
import { useFocusTrap } from "../hooks/useFocusTrap";

// ─── Constants ───

const ITEM_HEIGHT = 120;
const VIRTUALIZE_THRESHOLD = 20;

type DateRange = "all" | "week" | "month";

const selectClass =
  "rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/25";

// ─── Entry row component (defined outside for react-window perf) ───

type RowData = {
  entries: JournalEntry[];
  plantNames: Map<string, string>;
  temperatureUnit: "fahrenheit" | "celsius";
  onSelect: (entry: JournalEntry) => void;
};

function EntryRow({ index, style, data }: ListChildComponentProps<RowData>) {
  const entry = data.entries[index];
  if (!entry) return null;

  const plantName = entry.plantInstanceId
    ? data.plantNames.get(entry.plantInstanceId)
    : undefined;
  const firstPhotoId = entry.photoIds[0];
  const timeAgo = formatDistanceToNow(new Date(entry.createdAt), {
    addSuffix: true,
  });

  return (
    <div style={style} className="px-4 py-1">
      <button
        type="button"
        onClick={() => data.onSelect(entry)}
        className="flex w-full gap-3 rounded-xl border border-border-default bg-surface-elevated p-3 text-left shadow-sm transition-shadow hover:shadow-md"
        aria-label={`Journal entry: ${entry.body.slice(0, 50)}`}
      >
        {/* Photo or activity placeholder */}
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
          {firstPhotoId ? (
            <PhotoThumbnail
              photoId={firstPhotoId}
              alt="Entry photo"
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-medium text-brown-500">
              {ACTIVITY_LABELS[entry.activityType].slice(0, 3)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge>{ACTIVITY_LABELS[entry.activityType]}</Badge>
            {entry.weatherSnapshot?.tempC != null && (
              <span className="text-xs text-text-muted">
                {formatTemp(entry.weatherSnapshot.tempC, data.temperatureUnit)}
              </span>
            )}
            {plantName && (
              <span className="truncate text-xs text-text-secondary">
                {plantName}
              </span>
            )}
            <span className="ml-auto shrink-0 text-xs text-text-muted">
              {timeAgo}
            </span>
          </div>
          {entry.title && (
            <p className="mt-0.5 truncate text-sm font-medium text-text-primary">
              {entry.title}
            </p>
          )}
          <p className="mt-0.5 line-clamp-2 text-sm text-text-secondary">
            {entry.body}
          </p>
        </div>
      </button>
    </div>
  );
}

// ─── Entry detail overlay ───

function EntryDetail({
  entry,
  plantName,
  temperatureUnit,
  onClose,
  onEdit,
  onDelete,
}: {
  entry: JournalEntry;
  plantName: string | undefined;
  temperatureUnit: "fahrenheit" | "celsius";
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef);

  useEffect(() => {
    const firstPhotoId = entry.photoIds[0];
    if (!firstPhotoId) return;

    let url: string | undefined;
    let cancelled = false;

    void photoRepository.getDisplayBlob(firstPhotoId).then((blob) => {
      if (cancelled) return;
      if (blob) {
        url = URL.createObjectURL(blob);
        setDisplayUrl(url);
      }
    });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [entry.photoIds]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Prevent body scroll while overlay is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const timeAgo = formatDistanceToNow(new Date(entry.createdAt), {
    addSuffix: true,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Journal entry detail"
    >
      <div
        ref={modalRef}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface-elevated md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <div className="flex items-center justify-between px-4 pt-4">
          <Badge>{ACTIVITY_LABELS[entry.activityType]}</Badge>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
            aria-label="Close"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Photo */}
        {displayUrl && (
          <img
            src={displayUrl}
            alt="Entry photo"
            className="mt-3 w-full object-cover"
          />
        )}

        {/* Content */}
        <div className="p-4">
          {entry.title && (
            <h2 className="font-display text-lg font-semibold text-text-primary">
              {entry.title}
            </h2>
          )}

          <p className="mt-2 text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
            {entry.body}
          </p>

          {/* Metadata */}
          <div className="mt-4 space-y-1 text-xs text-text-secondary">
            <p>{timeAgo}</p>
            {plantName && (
              <p>
                Plant:{" "}
                <Link
                  to={`/plants/${entry.plantInstanceId}`}
                  className="font-medium text-text-heading hover:underline"
                >
                  {plantName}
                </Link>
              </p>
            )}
            {entry.weatherSnapshot?.tempC != null && (
              <p>
                Weather:{" "}
                <span className="font-medium text-text-secondary">
                  {formatTemp(entry.weatherSnapshot.tempC, temperatureUnit)}
                  {entry.weatherSnapshot.conditions
                    ? `, ${entry.weatherSnapshot.conditions}`
                    : ""}
                  {entry.weatherSnapshot.humidity != null
                    ? ` (${String(entry.weatherSnapshot.humidity)}% humidity)`
                    : ""}
                </span>
              </p>
            )}
            {entry.isMilestone && entry.milestoneType && (
              <p>
                Milestone:{" "}
                <span className="font-medium text-text-secondary">
                  {entry.milestoneType.replace(/_/g, " ")}
                </span>
              </p>
            )}
            {entry.activityType === "harvest" &&
              entry.harvestWeight != null && (
                <p>
                  Harvest:{" "}
                  <span className="font-medium text-text-secondary">
                    {entry.harvestWeight}g
                  </span>
                </p>
              )}
          </div>

          {/* Edit / Delete actions */}
          <div className="mt-4 flex gap-2 border-t border-border-default pt-4">
            <Button variant="secondary" onClick={onEdit}>
              Edit
            </Button>
            <Button
              variant="ghost"
              className="text-red-600 hover:text-red-700"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete
            </Button>
          </div>

          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <Card className="mt-3 border-terracotta-400/30 bg-terracotta-400/5">
              <p className="text-sm text-text-secondary">
                Delete this journal entry? This cannot be undone.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="bg-accent hover:bg-accent-hover"
                  onClick={onDelete}
                >
                  Delete
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FAB speed dial ───

function AddEntryFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-24 right-4 z-40 md:bottom-6">
      {/* Speed dial options */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-16 right-0 z-40 flex flex-col gap-2">
            <Link
              to="/quick-log"
              className="flex items-center gap-2 whitespace-nowrap rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform hover:bg-accent-hover active:scale-95"
              onClick={() => setOpen(false)}
            >
              Quick Log
            </Link>
            <Link
              to="/journal/new"
              className="flex items-center gap-2 whitespace-nowrap rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary shadow-lg transition-transform hover:bg-primary-hover active:scale-95"
              onClick={() => setOpen(false)}
            >
              New Entry
            </Link>
          </div>
        </>
      )}

      {/* Main FAB */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Add journal entry"
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-primary text-text-on-primary shadow-lg transition-transform hover:bg-primary-hover active:scale-95 ${
          open ? "rotate-45" : ""
        }`}
      >
        <PlusIcon className="h-7 w-7" />
      </button>
    </div>
  );
}

// ─── Main page component ───

export default function JournalPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useSettings();
  const allEntries = usePouchQuery(() => journalRepository.getAll());
  const allPlants = usePouchQuery(() => plantRepository.getAll());
  const allSeasons = usePouchQuery(() => seasonRepository.getAll());
  const activeSeason = usePouchQuery(() => seasonRepository.getActive());

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const [activityFilter, setActivityFilter] = useState<ActivityType | "">("");
  const [plantFilter, setPlantFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  // null = user hasn't interacted yet, use active season; "" = "All Seasons"; string = specific season
  const [seasonFilter, setSeasonFilter] = useState<string | null>(null);
  const [indexReady, setIndexReady] = useState(false);

  // Detail overlay
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(
    null,
  );

  // Delete handler
  const handleDeleteEntry = useCallback(async (entry: JournalEntry) => {
    try {
      await journalRepository.softDelete(entry.id);
      removeFromIndex(entry.id);
      void serializeIndex();
      setSelectedEntry(null);
      toast("Journal entry deleted", "success");
    } catch {
      toast("Failed to delete entry", "error");
    }
  }, [toast]);

  // List container height
  const [listHeight, setListHeight] = useState(400);
  const containerRef = useRef<HTMLDivElement>(null);

  // Derive effective season filter: default to active season until user interacts
  const effectiveSeasonFilter =
    seasonFilter === null ? (activeSeason?.id ?? "") : seasonFilter;

  // Load search index on mount
  useEffect(() => {
    void loadIndex()
      .then((loaded: boolean) => {
        if (!loaded) {
          return rebuildIndex();
        }
      })
      .then(() => {
        setIndexReady(true);
      });
  }, []);

  // Measure container height for react-window
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const first = entries[0];
      if (first) setListHeight(first.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Build plant name map
  const plantNames = useMemo(() => {
    const map = new Map<string, string>();
    if (!allPlants) return map;
    for (const p of allPlants) {
      map.set(p.id, p.nickname ?? p.species);
    }
    return map;
  }, [allPlants]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    if (!allEntries) return [];
    let results = [...allEntries];

    // Search filter
    if (debouncedQuery.trim() && indexReady) {
      const hits = searchIndex(debouncedQuery);
      const journalHitIds = new Set(
        hits
          .filter((h) => h.entityType === "journal")
          .map((h) => h.id),
      );
      results = results.filter((e) => journalHitIds.has(e.id));
    }

    // Activity type filter
    if (activityFilter) {
      results = results.filter((e) => e.activityType === activityFilter);
    }

    // Plant filter
    if (plantFilter) {
      results = results.filter(
        (e) => e.plantInstanceId === plantFilter,
      );
    }

    // Season filter
    if (effectiveSeasonFilter) {
      results = results.filter((e) => e.seasonId === effectiveSeasonFilter);
    }

    // Date range filter
    if (dateRange === "week") {
      const weekStart = startOfWeek(new Date());
      results = results.filter(
        (e) => new Date(e.createdAt) >= weekStart,
      );
    } else if (dateRange === "month") {
      const monthStart = startOfMonth(new Date());
      results = results.filter(
        (e) => new Date(e.createdAt) >= monthStart,
      );
    }

    return results;
  }, [
    allEntries,
    debouncedQuery,
    activityFilter,
    plantFilter,
    effectiveSeasonFilter,
    dateRange,
    indexReady,
  ]);

  // Row data for react-window (memoized to prevent re-renders)
  const handleSelect = useCallback((entry: JournalEntry) => {
    setSelectedEntry(entry);
  }, []);

  const rowData = useMemo<RowData>(
    () => ({
      entries: filteredEntries,
      plantNames,
      temperatureUnit: settings.temperatureUnit,
      onSelect: handleSelect,
    }),
    [filteredEntries, plantNames, settings.temperatureUnit, handleSelect],
  );

  // Loading state
  if (allEntries === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-4" role="status" aria-label="Loading journal">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-4 h-10 w-full" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[92px] w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto w-full max-w-3xl px-4 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-text-heading">
            Journal
          </h1>
          <span className="text-sm text-text-secondary">
            {allEntries.length}{" "}
            {allEntries.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {/* Search bar */}
        <div className="mt-4">
          <Input
            type="search"
            placeholder="Search journal..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search journal"
          />
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Season filter */}
          <select
            value={effectiveSeasonFilter}
            onChange={(e) => setSeasonFilter(e.target.value)}
            className={selectClass}
            aria-label="Filter by season"
          >
            <option value="">All Seasons</option>
            {allSeasons?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Plant filter */}
          <select
            value={plantFilter}
            onChange={(e) => setPlantFilter(e.target.value)}
            className={selectClass}
            aria-label="Filter by plant"
          >
            <option value="">All plants</option>
            {allPlants?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname ?? p.species}
              </option>
            ))}
          </select>

          {/* Activity type filter */}
          <select
            value={activityFilter}
            onChange={(e) =>
              setActivityFilter(e.target.value as ActivityType | "")
            }
            className={selectClass}
            aria-label="Filter by activity"
          >
            <option value="">All activities</option>
            {ALL_ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_LABELS[t]}
              </option>
            ))}
          </select>

          {/* Date range filter */}
          <div className="flex overflow-hidden rounded-lg border border-border-strong">
            {(["all", "week", "month"] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  dateRange === range
                    ? "bg-primary text-text-on-primary"
                    : "bg-surface text-text-secondary hover:bg-surface-muted"
                }`}
              >
                {range === "all"
                  ? "All"
                  : range === "week"
                    ? "This Week"
                    : "This Month"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feed */}
      {filteredEntries.length === 0 ? (
        <div className="mx-auto mt-12 max-w-3xl text-center">
          {allEntries.length === 0 ? (
            <>
              <ClipboardCheckIcon className="mx-auto h-16 w-16 text-text-muted" />
              <p className="mt-4 text-lg font-medium text-text-secondary">
                No journal entries yet
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Start logging with the + button below.
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-text-secondary">
                No entries match your filters
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Try adjusting your search or filters.
              </p>
            </>
          )}
        </div>
      ) : (
        filteredEntries.length >= VIRTUALIZE_THRESHOLD ? (
          <div ref={containerRef} className="mx-auto mt-3 w-full max-w-3xl flex-1">
            <FixedSizeList
              height={listHeight}
              width="100%"
              itemCount={filteredEntries.length}
              itemSize={ITEM_HEIGHT}
              itemData={rowData}
              overscanCount={5}
            >
              {EntryRow}
            </FixedSizeList>
          </div>
        ) : (
          <div className="mx-auto mt-3 w-full max-w-3xl pb-24">
            {filteredEntries.map((entry, index) => (
              <EntryRow
                key={entry.id}
                index={index}
                style={{}}
                data={rowData}
              />
            ))}
          </div>
        )
      )}

      {/* FAB */}
      <AddEntryFab />

      {/* Entry detail overlay */}
      {selectedEntry && (
        <EntryDetail
          entry={selectedEntry}
          plantName={
            selectedEntry.plantInstanceId
              ? plantNames.get(selectedEntry.plantInstanceId)
              : undefined
          }
          temperatureUnit={settings.temperatureUnit}
          onClose={() => setSelectedEntry(null)}
          onEdit={() => {
            const id = selectedEntry.id;
            setSelectedEntry(null);
            void navigate(`/journal/${id}/edit`);
          }}
          onDelete={() => void handleDeleteEntry(selectedEntry)}
        />
      )}
    </div>
  );
}
