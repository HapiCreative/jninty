import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import { ZodError } from "zod";
import { plantRepository, photoRepository, journalRepository, gardenBedRepository } from "../db/index.ts";
import { addToIndex, serializeIndex } from "../db/search";
import { usePhotoCapture } from "../hooks/usePhotoCapture";
import { useActiveSeason } from "../hooks/useActiveSeason";
import type { ProcessedPhoto } from "../services/photoProcessor";
import { useSettings } from "../hooks/useSettings";
import { fetchWeatherSnapshot } from "../services/weather";
import type { ActivityType, MilestoneType } from "../types";
import {
  ACTIVITY_LABELS,
  ALL_ACTIVITY_TYPES,
  MILESTONE_OPTIONS,
} from "../constants/plantLabels";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import {
  ChevronLeftIcon,
  CloseIcon,
  CameraIcon,
  ImageIcon,
} from "../components/icons";

// ─── Styles ───

const selectClass =
  "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/25";

const textareaClass =
  "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/25";

// ─── Field labels for Zod error messages ───

const FIELD_LABELS: Record<string, string> = {
  activityType: "Activity Type",
  body: "Body",
  title: "Title",
  plantInstanceId: "Plant",
  bedId: "Garden Bed",
  photoIds: "Photos",
  isMilestone: "Milestone",
  milestoneType: "Milestone Type",
  harvestWeight: "Harvest Weight",
};

// ─── Component ───

export default function JournalEntryFormPage() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const { settings } = useSettings();
  const isEdit = Boolean(editId);

  // Form state
  const [activityType, setActivityType] = useState<ActivityType | "">("");
  const [plantId, setPlantId] = useState("");
  const [bedId, setBedId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isMilestone, setIsMilestone] = useState(false);
  const [milestoneType, setMilestoneType] = useState<MilestoneType | "">("");
  const [harvestWeight, setHarvestWeight] = useState("");

  // Photo state
  const [photos, setPhotos] = useState<ProcessedPhoto[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const previewUrlsRef = useRef<string[]>([]);
  const { capturePhoto, selectPhoto, isProcessing, error: photoError } =
    usePhotoCapture({ keepOriginals: settings.keepOriginalPhotos });

  // Submission state
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Edit mode: existing entry & its season
  const [existingSeasonId, setExistingSeasonId] = useState<string | null>(null);
  const [existingPhotoIds, setExistingPhotoIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(!isEdit);

  // Load data for dropdowns + active season
  const plants = usePouchQuery(() => plantRepository.getByStatus("active"));
  const gardenBeds = usePouchQuery(() => gardenBedRepository.getAll());
  const activeSeason = useActiveSeason();

  // Load existing entry for edit mode
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    void journalRepository.getById(editId).then((entry) => {
      if (cancelled || !entry) return;
      setActivityType(entry.activityType);
      setPlantId(entry.plantInstanceId ?? "");
      setBedId(entry.bedId ?? "");
      setTitle(entry.title ?? "");
      setBody(entry.body);
      setIsMilestone(entry.isMilestone);
      setMilestoneType(entry.milestoneType ?? "");
      setHarvestWeight(
        entry.harvestWeight != null ? String(entry.harvestWeight) : "",
      );
      setExistingSeasonId(entry.seasonId);
      setExistingPhotoIds(entry.photoIds);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [editId]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  // ─── Photo handlers ───

  const handlePhoto = async (getPhoto: () => Promise<ProcessedPhoto>) => {
    try {
      const result = await getPhoto();
      const url = URL.createObjectURL(result.thumbnailBlob);
      previewUrlsRef.current.push(url);
      setPhotos((prev) => [...prev, result]);
      setPhotoPreviews((prev) => [...prev, url]);
    } catch {
      // Error is handled by usePhotoCapture hook
    }
  };

  const handleRemovePhoto = (index: number) => {
    const url = previewUrlsRef.current[index];
    if (url) URL.revokeObjectURL(url);
    previewUrlsRef.current.splice(index, 1);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Submit ───

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    // Client-side validation
    const validationErrors: string[] = [];
    if (!activityType) {
      validationErrors.push("Activity type is required.");
    }
    if (!body.trim()) {
      validationErrors.push("Body text is required.");
    }
    if (isMilestone && !milestoneType) {
      validationErrors.push("Select a milestone type.");
    }
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);

    try {
      // Save new photos
      const newPhotoIds: string[] = [];
      for (const p of photos) {
        const saved = await photoRepository.createWithFiles({
          thumbnailBlob: p.thumbnailBlob,
          displayBlob: p.displayBlob,
          ...(p.originalFile ? { originalFile: p.originalFile } : {}),
          width: p.width,
          height: p.height,
        });
        newPhotoIds.push(saved.id);
      }

      // Combine existing + new photo IDs for edit mode
      const photoIds = isEdit
        ? [...existingPhotoIds, ...newPhotoIds]
        : newPhotoIds;

      // Determine season: keep existing in edit mode, otherwise use active
      const seasonId = isEdit ? existingSeasonId : activeSeason?.id;
      if (!seasonId) {
        setErrors(["No active season found. Create one in Settings."]);
        setSaving(false);
        return;
      }

      const weight = parseFloat(harvestWeight);

      const fields = {
        activityType: activityType as ActivityType,
        body: body.trim(),
        photoIds,
        isMilestone,
        ...(plantId ? { plantInstanceId: plantId } : {}),
        ...(bedId ? { bedId } : {}),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(isMilestone && milestoneType
          ? { milestoneType: milestoneType as MilestoneType }
          : {}),
        ...(activityType === "harvest" && !isNaN(weight) && weight >= 0
          ? { harvestWeight: weight }
          : {}),
      };

      let entry;
      if (isEdit && editId) {
        entry = await journalRepository.update(editId, fields);
      } else {
        // Auto-capture weather snapshot if location is configured (new entries only)
        let weatherSnapshot:
          | { tempC: number; humidity: number; conditions: string }
          | undefined;
        if (settings.latitude != null && settings.longitude != null) {
          const snapshot = await fetchWeatherSnapshot(
            settings.latitude,
            settings.longitude,
          );
          if (snapshot) {
            weatherSnapshot = snapshot;
          }
        }

        entry = await journalRepository.create({
          ...fields,
          seasonId,
          ...(weatherSnapshot ? { weatherSnapshot } : {}),
        });
      }

      // Update search index
      addToIndex(entry, "journal");
      void serializeIndex();

      void navigate("/journal", { replace: true });
    } catch (err) {
      if (err instanceof ZodError) {
        setErrors(
          err.issues.map((issue) => {
            const field = issue.path[0];
            const label =
              typeof field === "string"
                ? (FIELD_LABELS[field] ?? field)
                : "Field";
            return `${label}: ${issue.message}`;
          }),
        );
      } else {
        const message =
          err instanceof Error ? err.message : "Failed to save entry.";
        setErrors([message]);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void navigate(-1)}
          className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
          aria-label="Go back"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="font-display text-2xl font-bold text-text-heading">
          {isEdit ? "Edit Journal Entry" : "New Journal Entry"}
        </h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-6">
        {/* Activity Type (required) */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-text-heading">
            Activity Type <span className="text-terracotta-500">*</span>
          </h2>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="group"
            aria-label="Activity type"
          >
            {ALL_ACTIVITY_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setActivityType(type)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  activityType === type
                    ? "bg-primary text-text-on-primary"
                    : "bg-surface-muted text-text-secondary hover:bg-surface-muted"
                }`}
              >
                {ACTIVITY_LABELS[type]}
              </button>
            ))}
          </div>
        </Card>

        {/* Details */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-text-heading">
            Details
          </h2>

          <div className="mt-4 space-y-4">
            {/* Plant selector */}
            <div>
              <label
                htmlFor="plant"
                className="mb-1 block text-sm font-medium text-text-secondary"
              >
                Plant
              </label>
              <select
                id="plant"
                value={plantId}
                onChange={(e) => setPlantId(e.target.value)}
                className={selectClass}
              >
                <option value="">None (optional)</option>
                {plants?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nickname ?? p.species}
                  </option>
                ))}
              </select>
            </div>

            {/* Bed/zone selector */}
            <div>
              <label
                htmlFor="bed"
                className="mb-1 block text-sm font-medium text-text-secondary"
              >
                Garden Bed
              </label>
              <select
                id="bed"
                value={bedId}
                onChange={(e) => setBedId(e.target.value)}
                className={selectClass}
              >
                <option value="">None (optional)</option>
                {gardenBeds?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label
                htmlFor="title"
                className="mb-1 block text-sm font-medium text-text-secondary"
              >
                Title
              </label>
              <Input
                id="title"
                type="text"
                placeholder="Optional title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Body (required) */}
            <div>
              <label
                htmlFor="body"
                className="mb-1 block text-sm font-medium text-text-secondary"
              >
                Body <span className="text-terracotta-500">*</span>
              </label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What happened?"
                rows={4}
                className={textareaClass}
              />
            </div>

            {/* Milestone toggle */}
            <div className="flex items-center gap-3">
              <label
                htmlFor="is-milestone"
                className="text-sm font-medium text-text-secondary"
              >
                Milestone
              </label>
              <button
                type="button"
                id="is-milestone"
                role="switch"
                aria-checked={isMilestone}
                onClick={() => {
                  setIsMilestone(!isMilestone);
                  if (isMilestone) setMilestoneType("");
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
                  isMilestone ? "bg-green-600" : "bg-border-strong"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    isMilestone ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Milestone type picker */}
            {isMilestone && (
              <div>
                <label
                  htmlFor="milestone-type"
                  className="mb-1 block text-sm font-medium text-text-secondary"
                >
                  Milestone Type <span className="text-terracotta-500">*</span>
                </label>
                <select
                  id="milestone-type"
                  value={milestoneType}
                  onChange={(e) =>
                    setMilestoneType(e.target.value as MilestoneType | "")
                  }
                  className={selectClass}
                >
                  <option value="">Select type...</option>
                  {MILESTONE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Harvest weight (only for harvest activity) */}
            {activityType === "harvest" && (
              <div>
                <label
                  htmlFor="harvest-weight"
                  className="mb-1 block text-sm font-medium text-text-secondary"
                >
                  Harvest Weight (g)
                </label>
                <Input
                  id="harvest-weight"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Weight in grams"
                  value={harvestWeight}
                  onChange={(e) => setHarvestWeight(e.target.value)}
                />
              </div>
            )}
          </div>
        </Card>

        {/* Photos */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-text-heading">
            Photos
          </h2>

          {/* Photo previews */}
          {photoPreviews.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {photoPreviews.map((url, i) => (
                <div key={url} className="relative">
                  <img
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="h-24 w-24 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(i)}
                    className="absolute -top-1 -right-1 rounded-full bg-soil-900/60 p-1 text-white transition-colors hover:bg-soil-900/80"
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    <CloseIcon className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add photo buttons */}
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isProcessing}
              onClick={() => void handlePhoto(capturePhoto)}
            >
              <CameraIcon className="-ml-0.5 mr-1.5 h-4 w-4" />
              {isProcessing ? "Processing..." : "Take Photo"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isProcessing}
              onClick={() => void handlePhoto(selectPhoto)}
            >
              <ImageIcon className="-ml-0.5 mr-1.5 h-4 w-4" />
              {isProcessing ? "Processing..." : "Choose"}
            </Button>
          </div>
          {photoError && (
            <p className="mt-1 text-sm text-terracotta-600">
              {photoError.message}
            </p>
          )}
        </Card>

        {/* Error display */}
        {errors.length > 0 && (
          <div className="rounded-lg bg-terracotta-400/10 p-3">
            {errors.map((err, i) => (
              <p key={i} className="text-sm text-terracotta-600">
                {err}
              </p>
            ))}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <Button type="submit" disabled={saving || !loaded}>
            {saving ? "Saving..." : isEdit ? "Update Entry" : "Save Entry"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void navigate("/journal")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
