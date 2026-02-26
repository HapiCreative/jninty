import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ZodError } from "zod";
import * as plantRepository from "../db/repositories/plantRepository";
import * as photoRepository from "../db/repositories/photoRepository";
import * as journalRepository from "../db/repositories/journalRepository";
import * as gardenBedRepository from "../db/repositories/gardenBedRepository";
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
  "w-full rounded-lg border border-brown-200 bg-cream-50 px-3 py-2 text-sm text-soil-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25";

const textareaClass =
  "w-full rounded-lg border border-brown-200 bg-cream-50 px-3 py-2 text-sm text-soil-900 placeholder:text-brown-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25";

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
  const { settings } = useSettings();

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

  // Load data for dropdowns + active season
  const plants = useLiveQuery(() => plantRepository.getByStatus("active"));
  const gardenBeds = useLiveQuery(() => gardenBedRepository.getAll());
  const activeSeason = useActiveSeason();

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
      // Save photos
      const photoIds: string[] = [];
      for (const p of photos) {
        const saved = await photoRepository.createWithFiles({
          thumbnailBlob: p.thumbnailBlob,
          displayBlob: p.displayBlob,
          ...(p.originalFile ? { originalFile: p.originalFile } : {}),
          width: p.width,
          height: p.height,
        });
        photoIds.push(saved.id);
      }

      // Build input — use conditional spread for optional fields
      // to satisfy exactOptionalPropertyTypes
      if (!activeSeason) {
        setErrors(["No active season found. Create one in Settings."]);
        setSaving(false);
        return;
      }

      const weight = parseFloat(harvestWeight);

      // Auto-capture weather snapshot if location is configured
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

      const entry = await journalRepository.create({
        activityType: activityType as ActivityType,
        body: body.trim(),
        photoIds,
        isMilestone,
        seasonId: activeSeason.id,
        ...(plantId ? { plantInstanceId: plantId } : {}),
        ...(bedId ? { bedId } : {}),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(isMilestone && milestoneType
          ? { milestoneType: milestoneType as MilestoneType }
          : {}),
        ...(activityType === "harvest" && !isNaN(weight) && weight >= 0
          ? { harvestWeight: weight }
          : {}),
        ...(weatherSnapshot ? { weatherSnapshot } : {}),
      });

      // Update search index
      addToIndex(entry);
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
          className="rounded-lg p-1.5 text-soil-600 transition-colors hover:bg-cream-200 hover:text-soil-900"
          aria-label="Go back"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="font-display text-2xl font-bold text-green-800">
          New Journal Entry
        </h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-6">
        {/* Activity Type (required) */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-green-800">
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
                    ? "bg-green-700 text-cream-50"
                    : "bg-cream-200 text-soil-700 hover:bg-cream-300"
                }`}
              >
                {ACTIVITY_LABELS[type]}
              </button>
            ))}
          </div>
        </Card>

        {/* Details */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-green-800">
            Details
          </h2>

          <div className="mt-4 space-y-4">
            {/* Plant selector */}
            <div>
              <label
                htmlFor="plant"
                className="mb-1 block text-sm font-medium text-soil-700"
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
                className="mb-1 block text-sm font-medium text-soil-700"
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
                className="mb-1 block text-sm font-medium text-soil-700"
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
                className="mb-1 block text-sm font-medium text-soil-700"
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
                className="text-sm font-medium text-soil-700"
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
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 ${
                  isMilestone ? "bg-green-600" : "bg-brown-200"
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
                  className="mb-1 block text-sm font-medium text-soil-700"
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
                  className="mb-1 block text-sm font-medium text-soil-700"
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
          <h2 className="font-display text-lg font-semibold text-green-800">
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
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Entry"}
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
