import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import { format, parseISO } from "date-fns";
import { plantRepository, journalRepository, taskRepository, photoRepository, plantingRepository, seasonRepository } from "../db/index.ts";
import { removeFromIndex, serializeIndex } from "../db/search";
import { useToast } from "../components/ui/Toast";
import type { Planting, PlantingOutcome } from "../validation/planting.schema";
import type { Season } from "../validation/season.schema";
import type { JournalEntry } from "../validation/journalEntry.schema";
import {
  TYPE_LABELS,
  STATUS_LABELS,
  STATUS_VARIANT,
  SOURCE_LABELS,
  ACTIVITY_LABELS,
} from "../constants/plantLabels";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import PhotoThumbnail from "../components/PhotoThumbnail";
import PhotoLightbox from "../components/PhotoLightbox";
import PhotoTimelineTab from "../components/plant/PhotoTimelineTab";
import type { PhotoWithContext } from "../components/plant/PhotoTimelineGrid";
import {
  PlantPlaceholderIcon,
  ChevronLeftIcon,
  PlusIcon,
} from "../components/icons";
import Skeleton from "../components/ui/Skeleton";

type Tab = "overview" | "season-history" | "photo-timeline";

// ─── Component ───

export default function PlantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Plant data (reactive)
  const plant = usePouchQuery(
    () =>
      id
        ? plantRepository.getById(id).then((p) => p ?? null)
        : Promise.resolve(null),
    [id],
  );

  // Journal entries for this plant
  const journalEntries = usePouchQuery(
    () => (id ? journalRepository.getByPlantId(id) : Promise.resolve([])),
    [id],
  );

  // Tasks for this plant
  const tasks = usePouchQuery(
    () => (id ? taskRepository.getByPlantId(id) : Promise.resolve([])),
    [id],
  );

  // Plantings for this plant
  const plantings = usePouchQuery(
    () => (id ? plantingRepository.getByPlant(id) : Promise.resolve([])),
    [id],
  );

  // All seasons (for looking up season names)
  const seasons = usePouchQuery(() => seasonRepository.getAll(), []);

  const { toast } = useToast();

  // Hero photo
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Planting outcome editing
  const [editingOutcome, setEditingOutcome] = useState<string | null>(null);

  // Load hero photo
  useEffect(() => {
    let revoked = false;
    let objectUrl: string | undefined;

    const photoId = plant?.photoIds?.[0];

    void (async () => {
      if (!photoId) {
        setHeroUrl(null);
        return;
      }

      const blob = await photoRepository.getDisplayBlob(photoId);
      if (revoked) return;
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setHeroUrl(objectUrl);
      } else {
        setHeroUrl(null);
      }
    })();

    return () => {
      revoked = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [plant?.photoIds]);

  // ─── Dialog keyboard handling ───

  const handleDialogKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && showDeleteConfirm) {
        setShowDeleteConfirm(false);
      }
    },
    [showDeleteConfirm],
  );

  useEffect(() => {
    if (showDeleteConfirm) {
      document.addEventListener("keydown", handleDialogKeyDown);
      // Prevent background scroll
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleDialogKeyDown);
      document.body.style.overflow = "";
    };
  }, [showDeleteConfirm, handleDialogKeyDown]);

  // Auto-focus dialog when opened
  useEffect(() => {
    if (showDeleteConfirm && dialogRef.current) {
      const cancelBtn = dialogRef.current.querySelector<HTMLButtonElement>(
        "[data-cancel]",
      );
      cancelBtn?.focus();
    }
  }, [showDeleteConfirm]);

  // Collect all photo IDs from plant + journal entries (deduplicated)
  const allPhotoIds = useMemo(() => {
    if (!plant) return [];
    const plantPhotos = plant.photoIds ?? [];
    const journalPhotos = journalEntries?.flatMap((e) => e.photoIds) ?? [];
    return Array.from(new Set([...plantPhotos, ...journalPhotos]));
  }, [plant, journalEntries]);

  // Photos with journal context (for photo timeline)
  const photosWithContext = useMemo<PhotoWithContext[]>(() => {
    if (!journalEntries) return [];
    const seen = new Set<string>();
    const result: PhotoWithContext[] = [];

    for (const entry of journalEntries) {
      for (const photoId of entry.photoIds) {
        if (!seen.has(photoId)) {
          seen.add(photoId);
          result.push({
            photoId,
            journalEntryId: entry.id,
            activityType: entry.activityType,
            body: entry.body,
            title: entry.title,
            isMilestone: entry.isMilestone,
            milestoneType: entry.milestoneType,
            createdAt: entry.createdAt,
            seasonId: entry.seasonId,
          });
        }
      }
    }

    // Include plant-level photos not in any journal entry
    const plantPhotos = plant?.photoIds ?? [];
    for (const photoId of plantPhotos) {
      if (!seen.has(photoId)) {
        seen.add(photoId);
        result.push({
          photoId,
          journalEntryId: "",
          activityType: "general",
          body: "",
          isMilestone: false,
          createdAt: plant?.createdAt ?? new Date().toISOString(),
          seasonId: "",
        });
      }
    }

    result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return result;
  }, [journalEntries, plant]);

  // Milestone entries (for growth story)
  const milestoneEntries = useMemo(() => {
    if (!journalEntries) return [];
    return journalEntries
      .filter((e) => e.isMilestone)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [journalEntries]);

  // Captions for lightbox (photoId → journal body)
  const captions = useMemo<Record<string, string>>(() => {
    if (!journalEntries) return {};
    const map: Record<string, string> = {};
    for (const entry of journalEntries) {
      const caption = entry.title ?? entry.body;
      if (caption) {
        for (const photoId of entry.photoIds) {
          if (!(photoId in map)) {
            map[photoId] = caption;
          }
        }
      }
    }
    return map;
  }, [journalEntries]);

  // ─── Planting outcome handler ───

  const handleSetOutcome = async (plantingId: string, outcome: PlantingOutcome) => {
    try {
      await plantingRepository.update(plantingId, { outcome });
      setEditingOutcome(null);
      toast("Outcome updated", "success");
    } catch {
      toast("Failed to update outcome", "error");
    }
  };

  // ─── Delete handler ───

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await plantRepository.softDelete(id);
      removeFromIndex(id);
      void serializeIndex();
      void navigate("/plants", { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete plant.";
      setDeleteError(message);
      setDeleting(false);
    }
  };

  // ─── Loading / not found ───

  if (plant === undefined) {
    return (
      <div className="mx-auto max-w-2xl" role="status" aria-label="Loading plant details">
        <Skeleton className="aspect-[16/9] w-full rounded-none" />
        <div className="space-y-4 p-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (plant === null) {
    return (
      <div className="p-4 text-center">
        <p className="text-lg font-medium text-text-secondary">Plant not found</p>
        <Link
          to="/plants"
          className="mt-2 inline-block text-sm text-text-heading hover:underline"
        >
          Back to Plant Inventory
        </Link>
      </div>
    );
  }

  const displayName = plant.nickname ?? plant.species;
  const pendingTasks = tasks?.filter((t) => !t.isCompleted) ?? [];

  const seasonMap = new Map(seasons?.map((s) => [s.id, s.name]));
  const outcomeVariant: Record<string, "success" | "warning" | "danger" | "default"> = {
    thrived: "success",
    ok: "warning",
    failed: "danger",
    unknown: "default",
  };

  return (
    <div className="mx-auto max-w-2xl pb-8">
      {/* Hero photo */}
      <div className="relative aspect-[16/9] bg-surface-muted">
        {heroUrl ? (
          <button
            type="button"
            className="h-full w-full"
            onClick={() => {
              setLightboxIndex(0);
              setShowLightbox(true);
            }}
          >
            <img
              src={heroUrl}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          </button>
        ) : (
          <div className="flex h-full items-center justify-center">
            <PlantPlaceholderIcon className="h-20 w-20 text-text-muted" />
          </div>
        )}

        {/* Back button overlay */}
        <button
          type="button"
          onClick={() => navigate("/plants")}
          className="absolute top-3 left-3 rounded-full bg-soil-900/40 p-2 text-white transition-colors hover:bg-soil-900/60"
          aria-label="Back to plants"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        {/* Name + badges */}
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            {displayName}
          </h1>
          {plant.nickname && (
            <p className="mt-0.5 text-text-secondary italic">{plant.species}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge>{TYPE_LABELS[plant.type]}</Badge>
            <Badge variant={STATUS_VARIANT[plant.status]}>
              {STATUS_LABELS[plant.status]}
            </Badge>
            {plant.tags.map((tag) => (
              <Badge key={tag} variant="default">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex overflow-hidden rounded-lg border border-border-strong">
          {([
            { key: "overview" as const, label: "Overview" },
            { key: "season-history" as const, label: "Seasons" },
            { key: "photo-timeline" as const, label: "Photos" },
          ]).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-primary text-text-on-primary"
                  : "bg-surface text-text-secondary hover:bg-surface-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "season-history" && (
          <SeasonHistoryTab
            plantings={plantings ?? []}
            seasonMap={seasonMap}
            seasons={seasons ?? []}
            journalEntries={journalEntries ?? []}
          />
        )}

        {activeTab === "photo-timeline" && (
          <PhotoTimelineTab
            photosWithContext={photosWithContext}
            milestoneEntries={milestoneEntries}
            onPhotoClick={(photoId) => {
              const index = allPhotoIds.indexOf(photoId);
              if (index !== -1) {
                setLightboxIndex(index);
                setShowLightbox(true);
              }
            }}
          />
        )}

        {activeTab === "overview" && (
        <>
        {/* Quick Log button */}
        <Link
          to={`/quick-log?plantId=${plant.id}`}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          <PlusIcon className="h-5 w-5" />
          Quick Log
        </Link>

        {/* Plant details card */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-text-heading">
            Details
          </h2>
          <dl className="mt-3 space-y-2">
            {plant.variety && (
              <div className="flex justify-between">
                <dt className="text-sm text-text-secondary">Variety</dt>
                <dd className="text-sm font-medium text-text-primary">
                  {plant.variety}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-sm text-text-secondary">Perennial</dt>
              <dd className="text-sm font-medium text-text-primary">
                {plant.isPerennial ? "Yes" : "No"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-text-secondary">Source</dt>
              <dd className="text-sm font-medium text-text-primary">
                {SOURCE_LABELS[plant.source]}
              </dd>
            </div>
            {plant.dateAcquired && (
              <div className="flex justify-between">
                <dt className="text-sm text-text-secondary">Date Acquired</dt>
                <dd className="text-sm font-medium text-text-primary">
                  {format(parseISO(plant.dateAcquired), "MMM d, yyyy")}
                </dd>
              </div>
            )}
          </dl>
          {plant.careNotes && (
            <div className="mt-4 border-t border-border-default pt-3">
              <h3 className="text-sm font-medium text-text-secondary">Care Notes</h3>
              <p className="mt-1 text-sm whitespace-pre-wrap text-text-primary">
                {plant.careNotes}
              </p>
            </div>
          )}
        </Card>

        {/* Photo gallery */}
        {allPhotoIds.length > 0 && (
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-text-heading">
                Photos
              </h2>
              <span className="text-sm text-text-secondary">
                {String(allPhotoIds.length)}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {allPhotoIds.map((pId, index) => (
                <button
                  key={pId}
                  type="button"
                  onClick={() => {
                    setLightboxIndex(index);
                    setShowLightbox(true);
                  }}
                  className="aspect-square overflow-hidden rounded-lg"
                >
                  <PhotoThumbnail
                    photoId={pId}
                    alt={`Photo ${String(index + 1)}`}
                    className="h-full w-full"
                  />
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Plantings */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-text-heading">
              Plantings
            </h2>
            <span className="text-sm text-text-secondary">
              {plantings?.length ?? 0}
            </span>
          </div>
          {plantings && plantings.length > 0 ? (
            <ul className="mt-3 divide-y divide-border-default">
              {plantings.map((planting) => (
                <li key={planting.id} className="py-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {seasonMap.get(planting.seasonId) ?? "Unknown Season"}
                      </p>
                      {planting.datePlanted && (
                        <p className="mt-0.5 text-xs text-text-secondary">
                          Planted: {format(parseISO(planting.datePlanted), "MMM d, yyyy")}
                        </p>
                      )}
                      {planting.dateRemoved && (
                        <p className="text-xs text-text-secondary">
                          Removed: {format(parseISO(planting.dateRemoved), "MMM d, yyyy")}
                        </p>
                      )}
                      {planting.notes && (
                        <p className="mt-0.5 text-sm text-text-secondary line-clamp-2">
                          {planting.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editingOutcome === planting.id ? (
                        <div className="flex flex-wrap gap-1">
                          {(["thrived", "ok", "failed", "unknown"] as const).map(
                            (o) => (
                              <button
                                key={o}
                                type="button"
                                onClick={() =>
                                  void handleSetOutcome(planting.id, o)
                                }
                                className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                                  planting.outcome === o
                                    ? "bg-primary text-white"
                                    : "bg-surface-muted text-text-secondary hover:bg-surface-muted"
                                }`}
                              >
                                {o}
                              </button>
                            ),
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingOutcome(planting.id)}
                          className="flex items-center gap-1"
                          title="Set outcome"
                        >
                          {planting.outcome ? (
                            <Badge variant={outcomeVariant[planting.outcome] ?? "default"}>
                              {planting.outcome}
                            </Badge>
                          ) : (
                            <span className="rounded-full border border-dashed border-border-strong px-2 py-0.5 text-xs text-text-secondary hover:border-focus-ring hover:text-text-heading">
                              Set outcome
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-text-secondary">
              No plantings yet.
            </p>
          )}
        </Card>

        {/* Journal entries */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-text-heading">
              Journal Entries
            </h2>
            <span className="text-sm text-text-secondary">
              {journalEntries?.length ?? 0}
            </span>
          </div>
          {journalEntries && journalEntries.length > 0 ? (
            <ul className="mt-3 divide-y divide-border-default">
              {journalEntries.map((entry) => (
                <li key={entry.id} className="py-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {entry.title ?? ACTIVITY_LABELS[entry.activityType]}
                      </p>
                      <p className="mt-0.5 text-sm text-text-secondary line-clamp-2">
                        {entry.body}
                      </p>
                    </div>
                    <Badge>
                      {ACTIVITY_LABELS[entry.activityType]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-text-secondary">
              No journal entries yet.
            </p>
          )}
        </Card>

        {/* Tasks */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-text-heading">
              Tasks
            </h2>
            <span className="text-sm text-text-secondary">
              {pendingTasks.length} pending
            </span>
          </div>
          {pendingTasks.length > 0 ? (
            <ul className="mt-3 divide-y divide-border-default">
              {pendingTasks.map((task) => (
                <li key={task.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {task.title}
                    </p>
                    {task.dueDate && (
                      <p className="text-xs text-text-secondary">
                        Due: {format(parseISO(task.dueDate), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={
                      task.priority === "urgent"
                        ? "danger"
                        : task.priority === "normal"
                          ? "warning"
                          : "default"
                    }
                  >
                    {task.priority}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-text-secondary">No pending tasks.</p>
          )}
        </Card>
        </>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            onClick={() => void navigate(`/plants/${plant.id}/edit`)}
          >
            Edit Plant
          </Button>
          <Button
            variant="ghost"
            className="text-terracotta-600 hover:bg-terracotta-400/10"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete
          </Button>
        </div>

        {/* Delete confirmation dialog */}
        {showDeleteConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-soil-900/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowDeleteConfirm(false);
            }}
          >
            <Card className="w-full max-w-sm" ref={dialogRef}>
              <h3
                id="delete-dialog-title"
                className="font-display text-lg font-semibold text-text-primary"
              >
                Delete {displayName}?
              </h3>
              <p className="mt-2 text-sm text-text-secondary">
                This plant will be removed from your inventory. This action
                cannot be undone.
              </p>
              {deleteError && (
                <p className="mt-2 text-sm text-terracotta-600">
                  {deleteError}
                </p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  data-cancel
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="bg-accent hover:bg-accent-hover"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Photo lightbox */}
      {showLightbox && allPhotoIds.length > 0 && (
        <PhotoLightbox
          photoIds={allPhotoIds}
          initialIndex={lightboxIndex}
          onClose={() => setShowLightbox(false)}
          captions={captions}
        />
      )}
    </div>
  );
}

// ─── Season History Tab ───

const timelineOutcomeColor: Record<string, string> = {
  thrived: "bg-green-600",
  ok: "bg-amber-500",
  failed: "bg-terracotta-500",
  unknown: "bg-brown-300",
};

function SeasonHistoryTab({
  plantings,
  seasonMap,
  seasons,
  journalEntries,
}: {
  plantings: Planting[];
  seasonMap: Map<string, string>;
  seasons: Season[];
  journalEntries: JournalEntry[];
}) {
  if (plantings.length === 0) {
    return (
      <Card>
        <p className="text-center text-sm text-text-secondary">
          No season history yet.
        </p>
      </Card>
    );
  }

  // Sort plantings by season year (descending)
  const seasonYearMap = new Map(seasons.map((s) => [s.id, s.year]));
  const sorted = [...plantings].sort((a, b) => {
    const yearA = seasonYearMap.get(a.seasonId) ?? 0;
    const yearB = seasonYearMap.get(b.seasonId) ?? 0;
    return yearB - yearA;
  });

  // Compute timeline bounds across all plantings with dates
  const datesWithValues = sorted.flatMap((p) => {
    const dates: number[] = [];
    if (p.datePlanted) dates.push(parseISO(p.datePlanted).getTime());
    if (p.dateRemoved) dates.push(parseISO(p.dateRemoved).getTime());
    return dates;
  });

  const minTime = datesWithValues.length > 0 ? Math.min(...datesWithValues) : 0;
  const maxTime = datesWithValues.length > 0 ? Math.max(...datesWithValues) : 0;
  const timeRange = maxTime - minTime;

  // Group journal entry counts by seasonId
  const entryCountBySeason = new Map<string, number>();
  for (const e of journalEntries) {
    const count = entryCountBySeason.get(e.seasonId) ?? 0;
    entryCountBySeason.set(e.seasonId, count + 1);
  }

  // Harvest weight by seasonId
  const harvestBySeason = new Map<string, number>();
  for (const e of journalEntries) {
    if (e.activityType === "harvest" && e.harvestWeight != null) {
      const total = harvestBySeason.get(e.seasonId) ?? 0;
      harvestBySeason.set(e.seasonId, total + e.harvestWeight);
    }
  }

  return (
    <div className="space-y-4">
      {/* Visual timeline */}
      {timeRange > 0 && (
        <Card>
          <h2 className="font-display text-lg font-semibold text-text-heading">
            Timeline
          </h2>
          <div className="mt-3 space-y-2">
            {sorted.map((p) => {
              if (!p.datePlanted) return null;
              const startTime = parseISO(p.datePlanted).getTime();
              const endTime = p.dateRemoved
                ? parseISO(p.dateRemoved).getTime()
                : maxTime;
              const leftPct = ((startTime - minTime) / timeRange) * 100;
              const widthPct = Math.max(
                ((endTime - startTime) / timeRange) * 100,
                2,
              );
              const outcome = p.outcome ?? "unknown";
              const barColor = timelineOutcomeColor[outcome] ?? "bg-brown-300";

              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between text-xs text-text-secondary">
                    <span>{seasonMap.get(p.seasonId) ?? "Unknown"}</span>
                    <Badge
                      variant={
                        outcome === "thrived"
                          ? "success"
                          : outcome === "ok"
                            ? "warning"
                            : outcome === "failed"
                              ? "danger"
                              : "default"
                      }
                    >
                      {outcome}
                    </Badge>
                  </div>
                  <div className="relative mt-1 h-3 w-full rounded-full bg-surface-muted">
                    <div
                      className={`absolute top-0 h-3 rounded-full ${barColor}`}
                      style={{
                        left: `${String(leftPct)}%`,
                        width: `${String(widthPct)}%`,
                      }}
                      title={`${format(parseISO(p.datePlanted), "MMM d, yyyy")}${p.dateRemoved ? ` – ${format(parseISO(p.dateRemoved), "MMM d, yyyy")}` : " – present"}`}
                    />
                  </div>
                </div>
              );
            })}
            {/* Timeline axis labels */}
            <div className="flex justify-between text-[10px] text-text-muted">
              <span>{format(new Date(minTime), "MMM yyyy")}</span>
              <span>{format(new Date(maxTime), "MMM yyyy")}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Season details */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-text-heading">
          Season Details
        </h2>
        <ul className="mt-3 divide-y divide-border-default">
          {sorted.map((p) => {
            const outcome = p.outcome ?? "unknown";
            const journalCount = entryCountBySeason.get(p.seasonId) ?? 0;
            const harvestWeight = harvestBySeason.get(p.seasonId) ?? 0;

            return (
              <li key={p.id} className="py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-primary">
                    {seasonMap.get(p.seasonId) ?? "Unknown Season"}
                  </span>
                  <Badge
                    variant={
                      outcome === "thrived"
                        ? "success"
                        : outcome === "ok"
                          ? "warning"
                          : outcome === "failed"
                            ? "danger"
                            : "default"
                    }
                  >
                    {outcome}
                  </Badge>
                </div>
                <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
                  {p.datePlanted && (
                    <div className="flex justify-between">
                      <dt className="text-xs text-text-muted">Planted</dt>
                      <dd className="text-xs text-text-secondary">
                        {format(parseISO(p.datePlanted), "MMM d, yyyy")}
                      </dd>
                    </div>
                  )}
                  {p.dateRemoved && (
                    <div className="flex justify-between">
                      <dt className="text-xs text-text-muted">Removed</dt>
                      <dd className="text-xs text-text-secondary">
                        {format(parseISO(p.dateRemoved), "MMM d, yyyy")}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-xs text-text-muted">Journal entries</dt>
                    <dd className="text-xs text-text-secondary">{String(journalCount)}</dd>
                  </div>
                  {harvestWeight > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-xs text-text-muted">Harvest</dt>
                      <dd className="text-xs text-text-secondary">
                        {harvestWeight >= 1000
                          ? `${(harvestWeight / 1000).toFixed(1)} kg`
                          : `${String(Math.round(harvestWeight))} g`}
                      </dd>
                    </div>
                  )}
                </dl>
                {p.notes && (
                  <p className="mt-1.5 text-xs text-text-secondary line-clamp-2">
                    {p.notes}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
