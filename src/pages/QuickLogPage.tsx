import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import * as plantRepository from "../db/repositories/plantRepository";
import * as photoRepository from "../db/repositories/photoRepository";
import * as journalRepository from "../db/repositories/journalRepository";
import { addToIndex, serializeIndex } from "../db/search";
import { usePhotoCapture } from "../hooks/usePhotoCapture";
import { useActiveSeason } from "../hooks/useActiveSeason";
import type { ProcessedPhoto } from "../services/photoProcessor";
import { useSettings } from "../hooks/useSettings";
import { fetchWeatherSnapshot } from "../services/weather";
import type { ActivityType } from "../types";
import { ACTIVITY_LABELS } from "../constants/plantLabels";
import Button from "../components/ui/Button";
import {
  ChevronLeftIcon,
  CloseIcon,
  CameraIcon,
  ImageIcon,
  CheckIcon,
} from "../components/icons";

// ─── Quick-log activity types (subset for speed) ───

const QUICK_ACTIVITIES: ActivityType[] = [
  "watering",
  "pest",
  "harvest",
  "general",
];

// ─── Select style (matching other forms) ───

const selectClass =
  "w-full rounded-lg border border-brown-200 bg-cream-50 px-3 py-2 text-sm text-soil-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25";

// ─── Component ───

export default function QuickLogPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plantIdParam = searchParams.get("plantId");
  const bedIdParam = searchParams.get("bedId");

  // Settings (must be before usePhotoCapture which needs keepOriginalPhotos)
  const { settings } = useSettings();

  // Photo state
  const [photo, setPhoto] = useState<ProcessedPhoto | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const { capturePhoto, selectPhoto, isProcessing, error: photoError } =
    usePhotoCapture({ keepOriginals: settings.keepOriginalPhotos });

  // Form state
  const [plantId, setPlantId] = useState(plantIdParam ?? "");
  const [note, setNote] = useState("");
  const [activityType, setActivityType] = useState<ActivityType | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load active plants for dropdown + active season
  const plants = useLiveQuery(() => plantRepository.getByStatus("active"));
  const activeSeason = useActiveSeason();

  // Cleanup preview URL on unmount
  useEffect(() => {
    const ref = previewUrlRef;
    return () => {
      if (ref.current) {
        URL.revokeObjectURL(ref.current);
      }
    };
  }, []);

  // Auto-launch camera on mount for 3-tap speed
  const autoLaunched = useRef(false);
  useEffect(() => {
    if (autoLaunched.current) return;
    autoLaunched.current = true;
    void handlePhoto(capturePhoto).catch(() => {
      // Camera dismissed or unavailable — user can tap manually
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Photo handlers ───

  const handlePhoto = async (getPhoto: () => Promise<ProcessedPhoto>) => {
    try {
      const result = await getPhoto();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const url = URL.createObjectURL(result.thumbnailBlob);
      previewUrlRef.current = url;
      setPhoto(result);
      setPhotoPreview(url);
      setError(null);
    } catch {
      // Error is handled by usePhotoCapture hook
    }
  };

  const handleRemovePhoto = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPhoto(null);
    setPhotoPreview(null);
  };

  // ─── Save ───

  const handleSave = async () => {
    if (!photo && !note.trim()) {
      setError("Add a photo or note to save.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Save photo if captured
      const photoIds: string[] = [];
      if (photo) {
        const savedPhoto = await photoRepository.createWithFiles({
          thumbnailBlob: photo.thumbnailBlob,
          displayBlob: photo.displayBlob,
          ...(photo.originalFile ? { originalFile: photo.originalFile } : {}),
          width: photo.width,
          height: photo.height,
        });
        photoIds.push(savedPhoto.id);
      }

      // Build journal entry input — use spread for optional fields
      // to satisfy exactOptionalPropertyTypes
      if (!activeSeason) {
        setError("No active season found. Create one in Settings.");
        setSaving(false);
        return;
      }

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
        activityType: (activityType || "general") as ActivityType,
        body: note.trim() || "Quick log",
        photoIds,
        isMilestone: false,
        seasonId: activeSeason.id,
        ...(plantId ? { plantInstanceId: plantId } : {}),
        ...(bedIdParam ? { bedId: bedIdParam } : {}),
        ...(weatherSnapshot ? { weatherSnapshot } : {}),
      });

      // Update search index
      addToIndex(entry);
      void serializeIndex();

      setSuccess(true);
      setTimeout(() => void navigate("/journal"), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
      setSaving(false);
    }
  };

  // ─── Success screen ───

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div className="rounded-full bg-green-100 p-4">
          <CheckIcon className="h-8 w-8 text-green-700" />
        </div>
        <p className="mt-3 font-display text-lg font-semibold text-green-800">
          Saved!
        </p>
      </div>
    );
  }

  // ─── Main UI ───

  return (
    <div className="mx-auto max-w-lg p-4">
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
        <h1 className="font-display text-xl font-bold text-green-800">
          Quick Log
        </h1>
      </div>

      {/* Photo section */}
      <div className="mt-4">
        {photoPreview ? (
          <div className="relative">
            <img
              src={photoPreview}
              alt="Captured photo"
              className="max-h-64 w-full rounded-xl object-cover"
            />
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="absolute top-2 right-2 rounded-full bg-soil-900/60 p-1.5 text-white transition-colors hover:bg-soil-900/80"
              aria-label="Remove photo"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => void handlePhoto(capturePhoto)}
              className="flex flex-1 flex-col items-center gap-2 rounded-xl border-2 border-dashed border-green-600 bg-green-50 p-6 text-green-800 transition-colors hover:bg-green-100 disabled:opacity-50"
            >
              <CameraIcon className="h-10 w-10" />
              <span className="text-sm font-semibold">
                {isProcessing ? "Processing..." : "Take Photo"}
              </span>
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => void handlePhoto(selectPhoto)}
              className="flex flex-1 flex-col items-center gap-2 rounded-xl border-2 border-dashed border-brown-300 bg-cream-50 p-6 text-soil-700 transition-colors hover:bg-cream-200 disabled:opacity-50"
            >
              <ImageIcon className="h-10 w-10" />
              <span className="text-sm font-semibold">
                {isProcessing ? "Processing..." : "Gallery"}
              </span>
            </button>
          </div>
        )}
        {photoError && (
          <p className="mt-2 text-sm text-terracotta-600">
            {photoError.message}
          </p>
        )}
      </div>

      {/* Plant selector */}
      <div className="mt-4">
        <select
          value={plantId}
          onChange={(e) => setPlantId(e.target.value)}
          className={selectClass}
          aria-label="Select plant"
        >
          <option value="">No plant (optional)</option>
          {plants?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nickname ?? p.species}
            </option>
          ))}
        </select>
      </div>

      {/* Note */}
      <div className="mt-3">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What's happening in your garden?"
          rows={3}
          className="w-full rounded-lg border border-brown-200 bg-cream-50 px-3 py-2 text-sm text-soil-900 placeholder:text-brown-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25"
          aria-label="Note"
        />
      </div>

      {/* Activity type chips */}
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Activity type">
        {QUICK_ACTIVITIES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() =>
              setActivityType(activityType === type ? "" : type)
            }
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

      {/* Error display */}
      {error && (
        <p className="mt-3 text-sm text-terracotta-600">{error}</p>
      )}

      {/* Save button */}
      <Button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="mt-4 w-full"
      >
        {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
