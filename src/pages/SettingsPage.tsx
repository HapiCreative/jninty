import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Badge from "../components/ui/Badge";
import Skeleton from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { useSettings } from "../hooks/useSettings";
import { settingsRepository, seasonRepository, plantingRepository, plantRepository } from "../db/index.ts";
import type { PlantingOutcome } from "../validation/planting.schema";
import type { Planting } from "../validation/planting.schema";
import {
  getStorageUsage,
  formatBytes,
  type StorageUsage,
} from "../services/storageUsage";
import { exportAll, triggerDownload } from "../services/exporter";
import { rebuildIndex } from "../db/search";
import {
  searchLocation,
  clearWeatherCache,
  type GeoSearchResult,
} from "../services/weather";
import { localDB } from "../db/pouchdb/client.ts";

// ─── Growing zones (USDA 1a–13b) ───

const GROWING_ZONES: string[] = [];
for (let i = 1; i <= 13; i++) {
  GROWING_ZONES.push(`${String(i)}a`, `${String(i)}b`);
}

// ─── Toggle group ───

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-brown-200">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? "bg-green-700 text-cream-50"
              : "bg-cream-50 text-soil-700 hover:bg-cream-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Settings page ───

export default function SettingsPage() {
  const { toast } = useToast();
  const { settings, loading, updateSettings } = useSettings();

  // Local state for text input (saved on blur)
  const [gardenName, setGardenName] = useState("");

  // Storage dashboard
  const [storage, setStorage] = useState<StorageUsage | null>(null);

  // Action states
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [rebuildBusy, setRebuildBusy] = useState(false);
  const [rebuildCount, setRebuildCount] = useState<number | null>(null);
  const [rebuildError, setRebuildError] = useState<string | null>(null);
  const [clearingOriginals, setClearingOriginals] = useState(false);

  // Location search state
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<GeoSearchResult[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);

  // Local state for manual coordinate inputs (saved on blur)
  const [localLat, setLocalLat] = useState("");
  const [localLon, setLocalLon] = useState("");

  // Sync gardenName from settings on load
  useEffect(() => {
    setGardenName(settings.gardenName ?? "");
  }, [settings.gardenName]);

  // Sync lat/lon from settings on load
  useEffect(() => {
    setLocalLat(settings.latitude != null ? String(settings.latitude) : "");
  }, [settings.latitude]);
  useEffect(() => {
    setLocalLon(settings.longitude != null ? String(settings.longitude) : "");
  }, [settings.longitude]);

  // Load storage usage
  useEffect(() => {
    void getStorageUsage().then(setStorage);
  }, []);

  // ─── Handlers ───

  const handleGardenNameBlur = () => {
    const trimmed = gardenName.trim();
    if (trimmed && trimmed !== (settings.gardenName ?? "")) {
      void updateSettings({ gardenName: trimmed });
    }
  };

  const handleLatBlur = () => {
    const val = parseFloat(localLat);
    if (!isNaN(val) && val >= -90 && val <= 90 && val !== settings.latitude) {
      void clearWeatherCache().then(() => updateSettings({ latitude: val }));
    }
  };

  const handleLonBlur = () => {
    const val = parseFloat(localLon);
    if (
      !isNaN(val) &&
      val >= -180 &&
      val <= 180 &&
      val !== settings.longitude
    ) {
      void clearWeatherCache().then(() => updateSettings({ longitude: val }));
    }
  };

  const handleLocationSearch = async () => {
    if (!locationQuery.trim()) return;
    setLocationSearching(true);
    try {
      const results = await searchLocation(locationQuery.trim());
      setLocationResults(results);
    } catch {
      toast("Location search failed", "error");
    } finally {
      setLocationSearching(false);
    }
  };

  const handleSelectLocation = async (result: GeoSearchResult) => {
    await clearWeatherCache();
    await updateSettings({
      latitude: result.latitude,
      longitude: result.longitude,
    });
    setLocalLat(String(result.latitude));
    setLocalLon(String(result.longitude));
    setLocationResults([]);
    setLocationQuery("");
    toast(`Location set to ${result.name}`, "success");
  };

  const handleClearLocation = async () => {
    await clearWeatherCache();
    const updated = await settingsRepository.clearLocation();
    // Sync the context with the new settings (without lat/lon)
    await updateSettings(updated);
    toast("Location cleared", "success");
  };

  const handleExport = async () => {
    setExportBusy(true);
    setExportError(null);
    try {
      const blob = await exportAll();
      const date = new Date().toISOString().slice(0, 10);
      triggerDownload(blob, `jninty-export-${date}.zip`);
      await updateSettings({ lastExportDate: new Date().toISOString() });
      toast("Export downloaded!", "success");
    } catch {
      setExportError("Export failed. Please try again.");
      toast("Export failed", "error");
    } finally {
      setExportBusy(false);
    }
  };

  const handleClearOriginals = async () => {
    setClearingOriginals(true);
    try {
      // Remove "original" attachments from all photo docs in PouchDB
      const result = await localDB.allDocs({
        startkey: "photo:",
        endkey: "photo:\uffff",
        include_docs: true,
      });
      for (const row of result.rows) {
        const doc = row.doc as Record<string, unknown> | undefined;
        if (!doc) continue;
        const attachments = doc["_attachments"] as
          | Record<string, unknown>
          | undefined;
        if (attachments?.["original"]) {
          await localDB.removeAttachment(
            row.id,
            "original",
            row.value.rev,
          );
          // Re-fetch to get updated _rev, then update originalStored
          const updated = await localDB.get(row.id);
          await localDB.put({ ...updated, originalStored: false });
        }
      }
      // Refresh storage display
      const updated = await getStorageUsage();
      setStorage(updated);
      toast("Original photos cleared", "success");
    } catch {
      toast("Failed to clear originals", "error");
    } finally {
      setClearingOriginals(false);
    }
  };

  const handleRebuild = async () => {
    setRebuildBusy(true);
    setRebuildCount(null);
    setRebuildError(null);
    try {
      const count = await rebuildIndex();
      setRebuildCount(count);
      toast(`Indexed ${String(count)} items`, "success");
    } catch {
      setRebuildError("Rebuild failed. Please try again.");
      toast("Rebuild failed", "error");
    } finally {
      setRebuildBusy(false);
    }
  };

  // ─── Seasons ───

  const seasons = usePouchQuery(() => seasonRepository.getAll(), []);

  const [showNewSeason, setShowNewSeason] = useState(false);
  const [newSeason, setNewSeason] = useState({
    name: "",
    year: new Date().getFullYear(),
    startDate: "",
    endDate: "",
  });

  // End-of-season review
  const [showEndOfSeason, setShowEndOfSeason] = useState(false);
  const [endOfSeasonPlantings, setEndOfSeasonPlantings] = useState<Planting[]>([]);
  const [outcomeEdits, setOutcomeEdits] = useState<Record<string, PlantingOutcome>>({});
  const [savingOutcomes, setSavingOutcomes] = useState(false);

  const allPlants = usePouchQuery(() => plantRepository.getAll());
  const plantNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!allPlants) return map;
    for (const p of allPlants) map.set(p.id, p.nickname ?? p.species);
    return map;
  }, [allPlants]);

  const handleCreateSeason = async () => {
    if (!newSeason.name.trim() || !newSeason.startDate || !newSeason.endDate) return;

    // Check if there's an active season with unrated plantings
    const activeSeason = seasons?.find((s) => s.isActive);
    if (activeSeason) {
      const seasonPlantings = await plantingRepository.getBySeason(activeSeason.id);
      const unrated = seasonPlantings.filter((p) => p.outcome == null);
      if (unrated.length > 0) {
        setEndOfSeasonPlantings(seasonPlantings);
        const defaults: Record<string, PlantingOutcome> = {};
        for (const p of seasonPlantings) {
          defaults[p.id] = p.outcome ?? "unknown";
        }
        setOutcomeEdits(defaults);
        setShowEndOfSeason(true);
        return;
      }
    }

    await doCreateSeason();
  };

  const doCreateSeason = async () => {
    if (!newSeason.name.trim() || !newSeason.startDate || !newSeason.endDate) return;
    try {
      await seasonRepository.create({
        name: newSeason.name.trim(),
        year: newSeason.year,
        startDate: newSeason.startDate,
        endDate: newSeason.endDate,
        isActive: false,
      });
      setNewSeason({ name: "", year: new Date().getFullYear(), startDate: "", endDate: "" });
      setShowNewSeason(false);
      toast("Season created", "success");
    } catch {
      toast("Failed to create season", "error");
    }
  };

  const handleSaveOutcomesAndCreate = async () => {
    setSavingOutcomes(true);
    try {
      for (const [plantingId, outcome] of Object.entries(outcomeEdits)) {
        await plantingRepository.update(plantingId, { outcome });
      }
      setShowEndOfSeason(false);
      await doCreateSeason();
      toast("Outcomes saved", "success");
    } catch {
      toast("Failed to save outcomes", "error");
    } finally {
      setSavingOutcomes(false);
    }
  };

  const handleSkipOutcomes = async () => {
    setShowEndOfSeason(false);
    await doCreateSeason();
  };

  const handleSetActive = async (id: string) => {
    try {
      await seasonRepository.setActive(id);
      toast("Active season updated", "success");
    } catch {
      toast("Failed to set active season", "error");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4" role="status" aria-label="Loading settings">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="font-display text-2xl font-bold text-green-800">
        Settings
      </h1>

      {/* ── Garden Information ── */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-green-800">
          Garden Information
        </h2>

        <div className="mt-4 space-y-4">
          {/* Growing zone */}
          <div>
            <label
              htmlFor="growing-zone"
              className="mb-1 block text-sm font-medium text-soil-700"
            >
              Growing Zone
            </label>
            <select
              id="growing-zone"
              value={settings.growingZone}
              onChange={(e) =>
                void updateSettings({ growingZone: e.target.value })
              }
              className="w-full rounded-lg border border-brown-200 bg-cream-50 px-3 py-2 text-sm text-soil-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25"
            >
              {GROWING_ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  Zone {zone}
                </option>
              ))}
            </select>
          </div>

          {/* Last spring frost date */}
          <div>
            <label
              htmlFor="last-frost"
              className="mb-1 block text-sm font-medium text-soil-700"
            >
              Last Spring Frost Date
            </label>
            <Input
              id="last-frost"
              type="date"
              value={settings.lastFrostDate}
              onChange={(e) => {
                if (e.target.value) {
                  void updateSettings({ lastFrostDate: e.target.value });
                }
              }}
            />
          </div>

          {/* First fall frost date */}
          <div>
            <label
              htmlFor="first-frost"
              className="mb-1 block text-sm font-medium text-soil-700"
            >
              First Fall Frost Date
            </label>
            <Input
              id="first-frost"
              type="date"
              value={settings.firstFrostDate}
              onChange={(e) => {
                if (e.target.value) {
                  void updateSettings({ firstFrostDate: e.target.value });
                }
              }}
            />
          </div>

          {/* Garden name */}
          <div>
            <label
              htmlFor="garden-name"
              className="mb-1 block text-sm font-medium text-soil-700"
            >
              Garden Name
            </label>
            <Input
              id="garden-name"
              type="text"
              placeholder="e.g. Backyard Garden"
              value={gardenName}
              onChange={(e) => setGardenName(e.target.value)}
              onBlur={handleGardenNameBlur}
            />
          </div>
        </div>
      </Card>

      {/* ── Location (Weather) ── */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-green-800">
          Location
        </h2>
        <p className="mt-1 text-xs text-soil-500">
          Used for weather on the dashboard and journal entries
        </p>

        <div className="mt-4 space-y-4">
          {/* Current location display */}
          {settings.latitude != null && settings.longitude != null && (
            <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3">
              <div>
                <p className="text-sm font-medium text-soil-800">
                  {String(settings.latitude.toFixed(4))},{" "}
                  {String(settings.longitude.toFixed(4))}
                </p>
                <p className="text-xs text-soil-500">Current coordinates</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => void handleClearLocation()}
              >
                Clear
              </Button>
            </div>
          )}

          {/* City search */}
          <div>
            <label
              htmlFor="location-search"
              className="mb-1 block text-sm font-medium text-soil-700"
            >
              Search by city
            </label>
            <div className="flex gap-2">
              <Input
                id="location-search"
                type="text"
                placeholder="e.g. Portland, OR"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleLocationSearch();
                }}
              />
              <Button
                variant="secondary"
                onClick={() => void handleLocationSearch()}
                disabled={locationSearching || !locationQuery.trim()}
              >
                {locationSearching ? "..." : "Search"}
              </Button>
            </div>
          </div>

          {/* Search results */}
          {locationResults.length > 0 && (
            <div className="space-y-1">
              {locationResults.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => void handleSelectLocation(r)}
                  className="flex w-full items-center justify-between rounded-lg border border-cream-200 bg-cream-50 p-3 text-left transition-colors hover:bg-cream-200"
                >
                  <div>
                    <span className="text-sm font-medium text-soil-800">
                      {r.name}
                    </span>
                    <span className="ml-1 text-xs text-soil-500">
                      {[r.admin1, r.country].filter(Boolean).join(", ")}
                    </span>
                  </div>
                  <span className="text-xs text-soil-400">
                    {String(r.latitude.toFixed(2))},{" "}
                    {String(r.longitude.toFixed(2))}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Manual coordinate entry */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="latitude"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Latitude
              </label>
              <Input
                id="latitude"
                type="number"
                step="any"
                min="-90"
                max="90"
                placeholder="e.g. 45.5231"
                value={localLat}
                onChange={(e) => setLocalLat(e.target.value)}
                onBlur={handleLatBlur}
              />
            </div>
            <div>
              <label
                htmlFor="longitude"
                className="mb-1 block text-sm font-medium text-soil-700"
              >
                Longitude
              </label>
              <Input
                id="longitude"
                type="number"
                step="any"
                min="-180"
                max="180"
                placeholder="e.g. -122.6765"
                value={localLon}
                onChange={(e) => setLocalLon(e.target.value)}
                onBlur={handleLonBlur}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* ── Preferences ── */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-green-800">
          Preferences
        </h2>

        <div className="mt-4 space-y-4">
          {/* Grid unit */}
          <div>
            <span className="mb-1 block text-sm font-medium text-soil-700">
              Grid Unit
            </span>
            <ToggleGroup
              options={[
                { label: "Feet", value: "feet" as const },
                { label: "Meters", value: "meters" as const },
              ]}
              value={settings.gridUnit}
              onChange={(unit) => void updateSettings({ gridUnit: unit })}
            />
          </div>

          {/* Temperature unit */}
          <div>
            <span className="mb-1 block text-sm font-medium text-soil-700">
              Temperature
            </span>
            <ToggleGroup
              options={[
                { label: "°F", value: "fahrenheit" as const },
                { label: "°C", value: "celsius" as const },
              ]}
              value={settings.temperatureUnit}
              onChange={(unit) =>
                void updateSettings({ temperatureUnit: unit })
              }
            />
          </div>

          {/* Theme */}
          <div>
            <span className="mb-1 block text-sm font-medium text-soil-700">
              Theme
            </span>
            <ToggleGroup
              options={[
                { label: "Light", value: "light" as const },
                { label: "Dark", value: "dark" as const },
                { label: "Auto", value: "auto" as const },
              ]}
              value={settings.theme}
              onChange={(theme) => void updateSettings({ theme })}
            />
          </div>

          {/* Keep original photos */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-soil-700">
                Keep Original Photos
              </span>
              <p className="text-xs text-soil-500">
                Stores full-resolution originals (requires more space)
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.keepOriginalPhotos}
              onClick={() =>
                void updateSettings({
                  keepOriginalPhotos: !settings.keepOriginalPhotos,
                })
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 ${
                settings.keepOriginalPhotos ? "bg-green-600" : "bg-brown-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  settings.keepOriginalPhotos
                    ? "translate-x-5"
                    : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </Card>

      {/* ── Seasons ── */}
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-green-800">
            Seasons
          </h2>
          <div className="flex items-center gap-2">
            {seasons && seasons.length >= 2 && (
              <Link
                to="/seasons/compare"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-green-700 transition-colors hover:bg-cream-200"
              >
                Compare
              </Link>
            )}
            <Button
              variant="ghost"
              onClick={() => setShowNewSeason((v) => !v)}
            >
              {showNewSeason ? "Cancel" : "New Season"}
            </Button>
          </div>
        </div>

        {showNewSeason && (
          <div className="mt-4 space-y-3 rounded-lg border border-cream-200 bg-cream-50 p-3">
            <div>
              <label htmlFor="season-name" className="mb-1 block text-sm font-medium text-soil-700">
                Name
              </label>
              <Input
                id="season-name"
                type="text"
                placeholder="e.g. Spring 2026"
                value={newSeason.name}
                onChange={(e) => setNewSeason((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="season-year" className="mb-1 block text-sm font-medium text-soil-700">
                Year
              </label>
              <Input
                id="season-year"
                type="number"
                value={String(newSeason.year)}
                onChange={(e) => setNewSeason((s) => ({ ...s, year: Number(e.target.value) }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="season-start" className="mb-1 block text-sm font-medium text-soil-700">
                  Start Date
                </label>
                <Input
                  id="season-start"
                  type="date"
                  value={newSeason.startDate}
                  onChange={(e) => setNewSeason((s) => ({ ...s, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="season-end" className="mb-1 block text-sm font-medium text-soil-700">
                  End Date
                </label>
                <Input
                  id="season-end"
                  type="date"
                  value={newSeason.endDate}
                  onChange={(e) => setNewSeason((s) => ({ ...s, endDate: e.target.value }))}
                />
              </div>
            </div>
            <Button onClick={() => void handleCreateSeason()}>
              Create Season
            </Button>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {seasons === undefined ? (
            <Skeleton className="h-12 w-full" />
          ) : seasons.length === 0 ? (
            <p className="text-sm text-soil-500">No seasons yet. Create one to get started.</p>
          ) : (
            seasons.map((season) => (
              <div
                key={season.id}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  season.isActive
                    ? "border-green-600 bg-green-50"
                    : "border-cream-200 bg-cream-50"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-soil-900">{season.name}</span>
                    <span className="text-sm text-soil-600">{String(season.year)}</span>
                    {season.isActive && <Badge variant="success">Active</Badge>}
                  </div>
                  <p className="text-xs text-soil-500">
                    {season.startDate} &ndash; {season.endDate}
                  </p>
                </div>
                {!season.isActive && (
                  <Button
                    variant="ghost"
                    onClick={() => void handleSetActive(season.id)}
                  >
                    Set Active
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* ── Data Management ── */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-green-800">
          Data Management
        </h2>

        <div className="mt-4 space-y-4">
          {/* Storage dashboard */}
          <div>
            <span className="mb-2 block text-sm font-medium text-soil-700">
              Storage
            </span>
            {storage ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-soil-600">
                  <span>Thumbnails: {formatBytes(storage.thumbnailBytes)}</span>
                  <span>Display: {formatBytes(storage.displayBytes)}</span>
                  <span>Originals: {formatBytes(storage.originalBytes)}</span>
                  <span>Data: {formatBytes(storage.dataBytes)}</span>
                </div>
                <p className="text-sm font-medium text-soil-800">
                  Total: {formatBytes(storage.totalBytes)}
                </p>
                {storage.quotaBytes > 0 && (
                  <div>
                    <div className="h-2 w-full rounded-full bg-cream-200">
                      <div
                        className="h-2 rounded-full bg-green-600 transition-all"
                        style={{
                          width: `${String(Math.min(100, (storage.totalBytes / storage.quotaBytes) * 100))}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-soil-500">
                      {formatBytes(storage.totalBytes)} of{" "}
                      {formatBytes(storage.quotaBytes)} used
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-soil-500">Calculating…</p>
            )}
          </div>

          {/* Export */}
          <div>
            <Button
              onClick={() => void handleExport()}
              disabled={exportBusy}
              variant="secondary"
            >
              {exportBusy ? "Exporting…" : "Export All Data"}
            </Button>
            {exportError && (
              <p className="mt-1 text-sm text-red-600">{exportError}</p>
            )}
            {settings.lastExportDate && (
              <p className="mt-1 text-xs text-soil-500">
                Last export:{" "}
                {new Date(settings.lastExportDate).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Clear original photos */}
          <div>
            <Button
              variant="ghost"
              onClick={() => void handleClearOriginals()}
              disabled={clearingOriginals}
            >
              {clearingOriginals
                ? "Clearing…"
                : "Clear Original Photos"}
            </Button>
            <p className="mt-1 text-xs text-soil-500">
              Removes stored full-resolution originals to reclaim space
            </p>
          </div>

          {/* Rebuild search index */}
          <div>
            <Button
              onClick={() => void handleRebuild()}
              disabled={rebuildBusy}
              variant="ghost"
            >
              {rebuildBusy ? "Rebuilding…" : "Rebuild Search Index"}
            </Button>
            {rebuildError && (
              <p className="mt-1 text-sm text-red-600">{rebuildError}</p>
            )}
            {rebuildCount != null && (
              <p className="mt-1 text-sm text-soil-600">
                Indexed {String(rebuildCount)} items.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* ── App version ── */}
      <p className="text-center text-xs text-soil-500">
        Jninty v{__APP_VERSION__}
      </p>

      {/* End-of-season review modal */}
      {showEndOfSeason && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-soil-900/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEndOfSeason(false);
          }}
        >
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-green-800">
              End of Season Review
            </h3>
            <p className="mt-1 text-sm text-soil-600">
              How did each planting do this season? Set outcomes before starting
              a new season.
            </p>

            <div className="mt-4 space-y-3">
              {endOfSeasonPlantings.map((planting) => (
                <div
                  key={planting.id}
                  className="flex items-center justify-between rounded-lg border border-cream-200 bg-cream-50 p-3"
                >
                  <span className="text-sm font-medium text-soil-900">
                    {plantNameMap.get(planting.plantInstanceId) ?? "Unknown Plant"}
                  </span>
                  <div className="flex gap-1">
                    {(["thrived", "ok", "failed", "unknown"] as const).map((o) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() =>
                          setOutcomeEdits((prev) => ({ ...prev, [planting.id]: o }))
                        }
                        className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                          outcomeEdits[planting.id] === o
                            ? o === "thrived"
                              ? "bg-green-600 text-white"
                              : o === "ok"
                                ? "bg-amber-500 text-white"
                                : o === "failed"
                                  ? "bg-terracotta-500 text-white"
                                  : "bg-soil-500 text-white"
                            : "bg-cream-200 text-soil-700 hover:bg-cream-300"
                        }`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                onClick={() => void handleSaveOutcomesAndCreate()}
                disabled={savingOutcomes}
              >
                {savingOutcomes ? "Saving..." : "Save & Create Season"}
              </Button>
              <Button variant="ghost" onClick={() => void handleSkipOutcomes()}>
                Skip
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
