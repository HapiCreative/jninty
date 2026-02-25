import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO } from "date-fns";
import * as plantRepository from "../db/repositories/plantRepository";
import * as journalRepository from "../db/repositories/journalRepository";
import * as taskRepository from "../db/repositories/taskRepository";
import * as photoRepository from "../db/repositories/photoRepository";
import { removeFromIndex, serializeIndex } from "../db/search";
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
import {
  PlantPlaceholderIcon,
  ChevronLeftIcon,
  PlusIcon,
} from "../components/icons";
import Skeleton from "../components/ui/Skeleton";

// ─── Component ───

export default function PlantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Plant data (reactive)
  const plant = useLiveQuery(
    () =>
      id
        ? plantRepository.getById(id).then((p) => p ?? null)
        : Promise.resolve(null),
    [id],
  );

  // Journal entries for this plant
  const journalEntries = useLiveQuery(
    () => (id ? journalRepository.getByPlantId(id) : Promise.resolve([])),
    [id],
  );

  // Tasks for this plant
  const tasks = useLiveQuery(
    () => (id ? taskRepository.getByPlantId(id) : Promise.resolve([])),
    [id],
  );

  // Hero photo
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

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

      const photo = await photoRepository.getById(photoId);
      if (revoked) return;
      const blob = photo?.displayBlob ?? photo?.thumbnailBlob;
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
        <p className="text-lg font-medium text-soil-700">Plant not found</p>
        <Link
          to="/plants"
          className="mt-2 inline-block text-sm text-green-700 hover:underline"
        >
          Back to Plant Inventory
        </Link>
      </div>
    );
  }

  const displayName = plant.nickname ?? plant.species;
  const pendingTasks = tasks?.filter((t) => !t.isCompleted) ?? [];

  return (
    <div className="mx-auto max-w-2xl pb-8">
      {/* Hero photo */}
      <div className="relative aspect-[16/9] bg-cream-200">
        {heroUrl ? (
          <img
            src={heroUrl}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <PlantPlaceholderIcon className="h-20 w-20 text-brown-300" />
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
          <h1 className="font-display text-2xl font-bold text-soil-900">
            {displayName}
          </h1>
          {plant.nickname && (
            <p className="mt-0.5 text-soil-600 italic">{plant.species}</p>
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

        {/* Quick Log button */}
        <Link
          to={`/quick-log?plantId=${plant.id}`}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-terracotta-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-terracotta-600"
        >
          <PlusIcon className="h-5 w-5" />
          Quick Log
        </Link>

        {/* Plant details card */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-green-800">
            Details
          </h2>
          <dl className="mt-3 space-y-2">
            {plant.variety && (
              <div className="flex justify-between">
                <dt className="text-sm text-soil-600">Variety</dt>
                <dd className="text-sm font-medium text-soil-900">
                  {plant.variety}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-sm text-soil-600">Perennial</dt>
              <dd className="text-sm font-medium text-soil-900">
                {plant.isPerennial ? "Yes" : "No"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-soil-600">Source</dt>
              <dd className="text-sm font-medium text-soil-900">
                {SOURCE_LABELS[plant.source]}
              </dd>
            </div>
            {plant.dateAcquired && (
              <div className="flex justify-between">
                <dt className="text-sm text-soil-600">Date Acquired</dt>
                <dd className="text-sm font-medium text-soil-900">
                  {format(parseISO(plant.dateAcquired), "MMM d, yyyy")}
                </dd>
              </div>
            )}
          </dl>
          {plant.careNotes && (
            <div className="mt-4 border-t border-cream-200 pt-3">
              <h3 className="text-sm font-medium text-soil-600">Care Notes</h3>
              <p className="mt-1 text-sm whitespace-pre-wrap text-soil-900">
                {plant.careNotes}
              </p>
            </div>
          )}
        </Card>

        {/* Journal entries */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-green-800">
              Journal Entries
            </h2>
            <span className="text-sm text-soil-500">
              {journalEntries?.length ?? 0}
            </span>
          </div>
          {journalEntries && journalEntries.length > 0 ? (
            <ul className="mt-3 divide-y divide-cream-200">
              {journalEntries.map((entry) => (
                <li key={entry.id} className="py-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-soil-900">
                        {entry.title ?? ACTIVITY_LABELS[entry.activityType]}
                      </p>
                      <p className="mt-0.5 text-sm text-soil-600 line-clamp-2">
                        {entry.body}
                      </p>
                    </div>
                    <Badge>
                      {ACTIVITY_LABELS[entry.activityType]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-soil-400">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-soil-500">
              No journal entries yet.
            </p>
          )}
        </Card>

        {/* Tasks */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-green-800">
              Tasks
            </h2>
            <span className="text-sm text-soil-500">
              {pendingTasks.length} pending
            </span>
          </div>
          {pendingTasks.length > 0 ? (
            <ul className="mt-3 divide-y divide-cream-200">
              {pendingTasks.map((task) => (
                <li key={task.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-soil-900 truncate">
                      {task.title}
                    </p>
                    {task.dueDate && (
                      <p className="text-xs text-soil-500">
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
            <p className="mt-3 text-sm text-soil-500">No pending tasks.</p>
          )}
        </Card>

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
                className="font-display text-lg font-semibold text-soil-900"
              >
                Delete {displayName}?
              </h3>
              <p className="mt-2 text-sm text-soil-600">
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
                  className="bg-terracotta-500 hover:bg-terracotta-600"
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
    </div>
  );
}
