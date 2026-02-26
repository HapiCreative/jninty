import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ZodError } from "zod";
import * as plantRepository from "../db/repositories/plantRepository";
import * as photoRepository from "../db/repositories/photoRepository";
import { addToIndex, serializeIndex } from "../db/search";
import { usePhotoCapture } from "../hooks/usePhotoCapture";
import { useSettings } from "../hooks/useSettings";
import type { ProcessedPhoto } from "../services/photoProcessor";
import type { PlantType, PlantSource, PlantStatus } from "../types";
import {
  TYPE_OPTIONS,
  SOURCE_OPTIONS,
  STATUS_OPTIONS,
} from "../constants/plantLabels";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { ChevronLeftIcon, CloseIcon } from "../components/icons";
import Skeleton from "../components/ui/Skeleton";

// ─── Select style ───

const selectClass =
  "w-full rounded-lg border border-brown-200 bg-cream-50 px-3 py-2 text-sm text-soil-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25";

// ─── Field label map for user-friendly Zod error messages ───

const FIELD_LABELS: Record<string, string> = {
  species: "Species",
  nickname: "Nickname",
  variety: "Variety",
  type: "Type",
  isPerennial: "Perennial",
  source: "Source",
  status: "Status",
  dateAcquired: "Date Acquired",
  careNotes: "Care Notes",
  tags: "Tags",
  photoIds: "Photos",
};

// ─── Component ───

export default function PlantFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  // Form state
  const [nickname, setNickname] = useState("");
  const [species, setSpecies] = useState("");
  const [variety, setVariety] = useState("");
  const [type, setType] = useState<PlantType>("vegetable");
  const [isPerennial, setIsPerennial] = useState(false);
  const [source, setSource] = useState<PlantSource>("unknown");
  const [status, setStatus] = useState<PlantStatus>("active");
  const [dateAcquired, setDateAcquired] = useState("");
  const [careNotes, setCareNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  // Photo state
  const [existingPhotoId, setExistingPhotoId] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [newPhoto, setNewPhoto] = useState<ProcessedPhoto | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const { settings } = useSettings();
  const { capturePhoto, selectPhoto, isProcessing, error: photoError } =
    usePhotoCapture({ keepOriginals: settings.keepOriginalPhotos });

  // Submission state
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(isEditing);

  // Load existing plant data for edit mode
  useEffect(() => {
    if (!id) return;

    void (async () => {
      const plant = await plantRepository.getById(id);
      if (!plant) {
        void navigate("/plants", { replace: true });
        return;
      }

      setNickname(plant.nickname ?? "");
      setSpecies(plant.species);
      setVariety(plant.variety ?? "");
      setType(plant.type);
      setIsPerennial(plant.isPerennial);
      setSource(plant.source);
      setStatus(plant.status);
      setDateAcquired(plant.dateAcquired ?? "");
      setCareNotes(plant.careNotes ?? "");
      setTagsInput(plant.tags.join(", "));

      // Load existing photo
      const photoId = plant.photoIds?.[0];
      if (photoId) {
        setExistingPhotoId(photoId);
        const photo = await photoRepository.getById(photoId);
        if (photo) {
          const url = URL.createObjectURL(photo.thumbnailBlob);
          setExistingPhotoUrl(url);
        }
      }

      setLoading(false);
    })();
  }, [id, navigate]);

  // Cleanup preview URLs
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  // Cleanup existing photo URL
  useEffect(() => {
    return () => {
      if (existingPhotoUrl) {
        URL.revokeObjectURL(existingPhotoUrl);
      }
    };
  }, [existingPhotoUrl]);

  // ─── Photo handlers ───

  const handlePhoto = async (
    getPhoto: () => Promise<ProcessedPhoto>,
  ) => {
    try {
      const photo = await getPhoto();
      // Revoke old preview URL
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const url = URL.createObjectURL(photo.thumbnailBlob);
      previewUrlRef.current = url;
      setNewPhoto(photo);
      setNewPhotoPreview(url);
    } catch {
      // Error is handled by usePhotoCapture
    }
  };

  const handleRemovePhoto = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setNewPhoto(null);
    setNewPhotoPreview(null);
    setExistingPhotoId(null);
    if (existingPhotoUrl) {
      URL.revokeObjectURL(existingPhotoUrl);
      setExistingPhotoUrl(null);
    }
  };

  // ─── Submit ───

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    // Basic validation
    if (!species.trim()) {
      setErrors(["Species is required."]);
      return;
    }

    setSaving(true);

    try {
      // Save new photo if one was added
      let photoIds: string[] | undefined;
      if (newPhoto) {
        const savedPhoto = await photoRepository.createWithFiles({
          thumbnailBlob: newPhoto.thumbnailBlob,
          displayBlob: newPhoto.displayBlob,
          ...(newPhoto.originalFile ? { originalFile: newPhoto.originalFile } : {}),
          width: newPhoto.width,
          height: newPhoto.height,
        });
        photoIds = [savedPhoto.id];
      } else if (existingPhotoId) {
        photoIds = [existingPhotoId];
      }

      // Parse tags
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      // Build the plant input
      const input: Parameters<typeof plantRepository.create>[0] = {
        species: species.trim(),
        type,
        isPerennial,
        source,
        status,
        tags,
      };

      // Only set optional fields if they have values
      const trimmedNickname = nickname.trim();
      if (trimmedNickname) input.nickname = trimmedNickname;

      const trimmedVariety = variety.trim();
      if (trimmedVariety) input.variety = trimmedVariety;

      if (dateAcquired) input.dateAcquired = dateAcquired;

      const trimmedNotes = careNotes.trim();
      if (trimmedNotes) input.careNotes = trimmedNotes;

      if (photoIds) input.photoIds = photoIds;

      let plant;
      if (isEditing && id) {
        plant = await plantRepository.update(id, input);
      } else {
        plant = await plantRepository.create(input);
      }

      // Update search index
      addToIndex(plant);
      void serializeIndex();

      void navigate(`/plants/${plant.id}`, { replace: true });
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
          err instanceof Error ? err.message : "Failed to save plant.";
        setErrors([message]);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-4" role="status" aria-label="Loading form">
        <Skeleton className="h-8 w-40" />
        <div className="mt-6 space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const currentPhotoPreview = newPhotoPreview ?? existingPhotoUrl;
  const backPath = isEditing && id ? `/plants/${id}` : "/plants";

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void navigate(backPath)}
          className="rounded-lg p-1.5 text-soil-600 transition-colors hover:bg-cream-200 hover:text-soil-900"
          aria-label="Go back"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="font-display text-2xl font-bold text-green-800">
          {isEditing ? "Edit Plant" : "Add Plant"}
        </h1>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-6">
        {/* Photo section */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-green-800">
            Photo
          </h2>
          <div className="mt-3">
            {currentPhotoPreview ? (
              <div className="relative">
                <img
                  src={currentPhotoPreview}
                  alt="Plant photo preview"
                  className="h-48 w-full rounded-lg object-cover"
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
              <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-brown-200 bg-cream-50">
                <p className="text-sm text-soil-500">No photo added</p>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isProcessing}
                onClick={() => void handlePhoto(capturePhoto)}
              >
                {isProcessing ? "Processing…" : "Take Photo"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isProcessing}
                onClick={() => void handlePhoto(selectPhoto)}
              >
                {isProcessing ? "Processing…" : "Choose Photo"}
              </Button>
            </div>
            {photoError && (
              <p className="mt-1 text-sm text-terracotta-600">
                {photoError.message}
              </p>
            )}
          </div>
        </Card>

        {/* Plant information */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-green-800">
            Plant Information
          </h2>

          <div className="mt-4 space-y-4">
            {/* Species (required) */}
            <div>
              <label
                htmlFor="species"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Species <span className="text-terracotta-500">*</span>
              </label>
              <Input
                id="species"
                type="text"
                placeholder="e.g. Solanum lycopersicum"
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
              />
            </div>

            {/* Nickname */}
            <div>
              <label
                htmlFor="nickname"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Nickname
              </label>
              <Input
                id="nickname"
                type="text"
                placeholder="e.g. Backyard Apple Tree"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            {/* Variety */}
            <div>
              <label
                htmlFor="variety"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Variety
              </label>
              <Input
                id="variety"
                type="text"
                placeholder="e.g. Honeycrisp"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
              />
            </div>

            {/* Type */}
            <div>
              <label
                htmlFor="plant-type"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Type
              </label>
              <select
                id="plant-type"
                value={type}
                onChange={(e) => setType(e.target.value as PlantType)}
                className={selectClass}
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Perennial toggle */}
            <div className="flex items-center gap-3">
              <label htmlFor="is-perennial" className="text-sm font-medium text-soil-700">
                Perennial
              </label>
              <button
                type="button"
                id="is-perennial"
                role="switch"
                aria-checked={isPerennial}
                onClick={() => setIsPerennial(!isPerennial)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 ${
                  isPerennial ? "bg-green-600" : "bg-brown-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    isPerennial ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Source */}
            <div>
              <label
                htmlFor="source"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Source
              </label>
              <select
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value as PlantSource)}
                className={selectClass}
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label
                htmlFor="status"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as PlantStatus)}
                className={selectClass}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date acquired */}
            <div>
              <label
                htmlFor="date-acquired"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Date Acquired
              </label>
              <Input
                id="date-acquired"
                type="date"
                value={dateAcquired}
                onChange={(e) => setDateAcquired(e.target.value)}
              />
            </div>

            {/* Tags */}
            <div>
              <label
                htmlFor="tags"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Tags
              </label>
              <Input
                id="tags"
                type="text"
                placeholder="e.g. raised bed, heirloom, organic"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
              <p className="mt-1 text-xs text-soil-500">
                Separate with commas
              </p>
            </div>

            {/* Care notes */}
            <div>
              <label
                htmlFor="care-notes"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Care Notes
              </label>
              <textarea
                id="care-notes"
                rows={3}
                placeholder="Any notes about caring for this plant…"
                value={careNotes}
                onChange={(e) => setCareNotes(e.target.value)}
                className="w-full rounded-lg border border-brown-200 bg-cream-50 px-3 py-2 text-sm text-soil-900 placeholder:text-brown-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25"
              />
            </div>
          </div>
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
            {saving
              ? "Saving…"
              : isEditing
                ? "Save Changes"
                : "Add Plant"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void navigate(backPath)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
