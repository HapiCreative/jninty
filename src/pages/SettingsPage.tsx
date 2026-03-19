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
import { useSync } from "../hooks/useSync";
import {
  getSyncConfig,
  clearSyncConfig,
  type SyncConfig,
} from "../services/syncConfigStore";
import { settingsRepository, seasonRepository, plantingRepository, plantRepository } from "../db/index.ts";
import type { PlantingOutcome } from "../validation/planting.schema";
import type { Planting } from "../validation/planting.schema";
import {
  getStorageUsage,
  formatBytes,
  type StorageUsage,
} from "../services/storageUsage";
import { exportAll, triggerDownload } from "../services/exporter";
import ImportDialog from "../components/ImportDialog";
import CsvImportDialog from "../components/CsvImportDialog";
import { rebuildIndex } from "../db/search";
import {
  searchLocation,
  clearWeatherCache,
  type GeoSearchResult,
} from "../services/weather";
import { localDB, getRemoteInfo, type RemoteDBInfo } from "../db/pouchdb/client.ts";
import { clearAllOriginals } from "../db/pouchdb/originalsStore.ts";
import { useNotifications } from "../hooks/useNotifications.ts";
import CloudSyncSettings from "../components/cloud/CloudSyncSettings";
import { useIsAuthenticated } from "../store/authStore";

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
    <div className="inline-flex overflow-hidden rounded-lg border border-border-strong">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? "bg-primary text-text-on-primary"
              : "bg-surface-elevated text-text-secondary hover:bg-surface-muted"
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
  const notifications = useNotifications();
  const isCloudUser = useIsAuthenticated();

  // Local state for text input (saved on blur)
  const [gardenName, setGardenName] = useState("");

  // Storage dashboard
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [remoteInfo, setRemoteInfo] = useState<RemoteDBInfo | null>(null);

  // Action states
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [rebuildBusy, setRebuildBusy] = useState(false);
  const [rebuildCount, setRebuildCount] = useState<number | null>(null);
  const [rebuildError, setRebuildError] = useState<string | null>(null);
  const [clearingOriginals, setClearingOriginals] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [clearDemoBusy, setClearDemoBusy] = useState(false);

  // Sync
  const {
    status: syncStatus,
    lastSynced,
    isConfigured: syncConfigured,
    startSync,
    stopSync,
    testConnection,
  } = useSync();

  const [syncUrl, setSyncUrl] = useState("");
  const [syncUsername, setSyncUsername] = useState("");
  const [syncPassword, setSyncPassword] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<{
    dbName: string;
    docCount: number;
  } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Load sync config from localStorage on mount
  useEffect(() => {
    const cfg = getSyncConfig();
    if (cfg) {
      setSyncUrl(cfg.remoteUrl);
      setSyncUsername(cfg.username);
      setSyncPassword(cfg.password);
    }
  }, []);

  const handleTestConnection = async () => {
    if (!syncUrl.trim()) return;
    setTestBusy(true);
    setTestResult(null);
    setTestError(null);
    try {
      const creds =
        syncUsername && syncPassword
          ? { username: syncUsername, password: syncPassword }
          : undefined;
      const info = await testConnection(syncUrl.trim(), creds);
      setTestResult({ dbName: info.dbName, docCount: info.docCount });
      toast("Connection successful!", "success");
    } catch {
      setTestError("Connection failed. Check URL and credentials.");
      toast("Connection failed", "error");
    } finally {
      setTestBusy(false);
    }
  };

  const handleStartSync = () => {
    const cfg: SyncConfig = {
      remoteUrl: syncUrl.trim(),
      username: syncUsername,
      password: syncPassword,
      enabled: true,
      lastSynced: null,
    };
    startSync(cfg);
    toast("Sync started", "success");
  };

  const handleStopSync = () => {
    stopSync();
    toast("Sync stopped", "success");
  };

  const handleSyncNow = () => {
    // Restart sync to trigger a fresh replication cycle
    const cfg: SyncConfig = {
      remoteUrl: syncUrl.trim(),
      username: syncUsername,
      password: syncPassword,
      enabled: true,
      lastSynced: lastSynced,
    };
    startSync(cfg);
  };

  const handleClearSync = () => {
    stopSync();
    clearSyncConfig();
    setSyncUrl("");
    setSyncUsername("");
    setSyncPassword("");
    setTestResult(null);
    setTestError(null);
    toast("Sync configuration cleared", "success");
  };

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

  // Load storage usage (local + remote)
  useEffect(() => {
    void getStorageUsage().then(setStorage);

    // Fetch remote DB info when sync is active
    const cfg = getSyncConfig();
    if (cfg?.enabled) {
      const creds =
        cfg.username && cfg.password
          ? { username: cfg.username, password: cfg.password }
          : undefined;
      void getRemoteInfo(cfg.remoteUrl, creds).then((info) => {
        if (info) setRemoteInfo(info);
      });
    }
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
      // Remove all originals from the local-only store
      await clearAllOriginals();

      // Update originalStored flag on all photo docs so the app knows
      // originals are no longer available
      const result = await localDB.allDocs({
        startkey: "photo:",
        endkey: "photo:\uffff",
        include_docs: true,
      });
      for (const row of result.rows) {
        const doc = row.doc as Record<string, unknown> | undefined;
        if (!doc) continue;
        if (doc["originalStored"] === true) {
          const latest = await localDB.get(row.id);
          await localDB.put({ ...latest, originalStored: false });
        }
      }

      // Also remove any legacy "original" attachments that may still exist
      // in the synced PouchDB (from before the migration to local-only store)
      for (const row of result.rows) {
        const doc = row.doc as Record<string, unknown> | undefined;
        if (!doc) continue;
        const attachments = doc["_attachments"] as
          | Record<string, unknown>
          | undefined;
        if (attachments?.["original"]) {
          try {
            const latest = await localDB.get(row.id);
            await localDB.removeAttachment(
              row.id,
              "original",
              (latest as PouchDB.Core.IdMeta & PouchDB.Core.GetMeta)._rev,
            );
          } catch {
            // Attachment already removed
          }
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

  const handleLoadDemo = async () => {
    setDemoBusy(true);
    setDemoError(null);
    try {
      const { loadDemoData } = await import("../services/demoSeeder.ts");
      await loadDemoData();
      toast("Demo data loaded", "success");
      // Reload page so all queries refetch
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load demo data";
      setDemoError(msg);
      toast("Failed to load demo data", "error");
    } finally {
      setDemoBusy(false);
    }
  };

  const handleClearDemo = async () => {
    setClearDemoBusy(true);
    try {
      const { clearDemoData } = await import("../services/demoSeeder.ts");
      await clearDemoData();
      toast("All data cleared", "success");
      window.location.reload();
    } catch {
      toast("Failed to clear data", "error");
    } finally {
      setClearDemoBusy(false);
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

  // Edit season state
  const [editSeasonId, setEditSeasonId] = useState<string | null>(null);
  const [editSeason, setEditSeason] = useState({ name: "", year: 0, startDate: "", endDate: "" });

  const startEditSeason = (season: { id: string; name: string; year: number; startDate: string; endDate: string }) => {
    setEditSeasonId(season.id);
    setEditSeason({ name: season.name, year: season.year, startDate: season.startDate, endDate: season.endDate });
  };

  const handleUpdateSeason = async () => {
    if (!editSeasonId || !editSeason.name.trim() || !editSeason.startDate || !editSeason.endDate) return;
    try {
      await seasonRepository.update(editSeasonId, {
        name: editSeason.name.trim(),
        year: editSeason.year,
        startDate: editSeason.startDate,
        endDate: editSeason.endDate,
      });
      setEditSeasonId(null);
      toast("Season updated", "success");
    } catch {
      toast("Failed to update season", "error");
    }
  };

  const [deleteSeasonId, setDeleteSeasonId] = useState<string | null>(null);
  const [deletingSeason, setDeletingSeason] = useState(false);
  const deleteSeasonName = seasons?.find((s) => s.id === deleteSeasonId)?.name;

  const handleDeleteSeason = async () => {
    if (!deleteSeasonId) return;
    setDeletingSeason(true);
    try {
      await seasonRepository.softDelete(deleteSeasonId);
      setDeleteSeasonId(null);
      toast("Season deleted", "success");
    } catch {
      toast("Failed to delete season", "error");
    } finally {
      setDeletingSeason(false);
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
      <h1 className="font-display text-2xl font-bold text-text-heading">
        Settings
      </h1>

      {/* ── Garden Information ── */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-text-heading">
          Garden Information
        </h2>

        <div className="mt-4 space-y-4">
          {/* Growing zone */}
          <div>
            <label
              htmlFor="growing-zone"
              className="mb-1 block text-sm font-medium text-text-secondary"
            >
              Growing Zone
            </label>
            <select
              id="growing-zone"
              value={settings.growingZone}
              onChange={(e) =>
                void updateSettings({ growingZone: e.target.value })
              }
              className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/25"
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
              className="mb-1 block text-sm font-medium text-text-secondary"
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
              className="mb-1 block text-sm font-medium text-text-secondary"
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
              className="mb-1 block text-sm font-medium text-text-secondary"
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
        <h2 className="font-display text-lg font-semibold text-text-heading">
          Location
        </h2>
        <p className="mt-1 text-xs text-text-muted">
          Used for weather on the dashboard and journal entries
        </p>

        <div className="mt-4 space-y-4">
          {/* Current location display */}
          {settings.latitude != null && settings.longitude != null && (
            <div className="flex items-center justify-between rounded-lg border border-border-default bg-status-success-bg p-3">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {String(settings.latitude.toFixed(4))},{" "}
                  {String(settings.longitude.toFixed(4))}
                </p>
                <p className="text-xs text-text-muted">Current coordinates</p>
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
              className="mb-1 block text-sm font-medium text-text-secondary"
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
                  className="flex w-full items-center justify-between rounded-lg border border-border-default bg-surface p-3 text-left transition-colors hover:bg-surface-muted"
                >
                  <div>
                    <span className="text-sm font-medium text-text-primary">
                      {r.name}
                    </span>
                    <span className="ml-1 text-xs text-text-muted">
                      {[r.admin1, r.country].filter(Boolean).join(", ")}
                    </span>
                  </div>
                  <span className="text-xs text-text-muted">
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
                className="mb-1 block text-sm font-medium text-text-secondary"
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
                className="mb-1 block text-sm font-medium text-text-secondary"
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
        <h2 className="font-display text-lg font-semibold text-text-heading">
          Preferences
        </h2>

        <div className="mt-4 space-y-4">
          {/* Grid unit */}
          <div>
            <span className="mb-1 block text-sm font-medium text-text-secondary">
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
            <span className="mb-1 block text-sm font-medium text-text-secondary">
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
            <span className="mb-1 block text-sm font-medium text-text-secondary">
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

          {/* High Contrast */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-text-secondary">
                High Contrast
              </span>
              <p className="text-xs text-text-muted">
                Increases contrast for better readability
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.highContrast}
              onClick={() =>
                void updateSettings({
                  highContrast: !settings.highContrast,
                })
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
                settings.highContrast ? "bg-primary" : "bg-border-strong"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-surface-elevated shadow-sm transition-transform ${
                  settings.highContrast
                    ? "translate-x-5"
                    : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Font Size */}
          <div>
            <span className="mb-1 block text-sm font-medium text-text-secondary">
              Font Size
            </span>
            <ToggleGroup
              options={[
                { label: "Normal", value: "normal" as const },
                { label: "Large", value: "large" as const },
                { label: "Extra Large", value: "extra-large" as const },
              ]}
              value={settings.fontSize}
              onChange={(fontSize) => void updateSettings({ fontSize })}
            />
          </div>

          <p className="text-xs text-text-muted">
            Press <kbd className="rounded border border-border-strong bg-surface-muted px-1 py-0.5 font-mono text-[10px]">?</kbd> anywhere to view keyboard shortcuts
          </p>

          {/* Keep original photos */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-text-secondary">
                Keep Original Photos
              </span>
              <p className="text-xs text-text-muted">
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
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
                settings.keepOriginalPhotos ? "bg-primary" : "bg-border-strong"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-surface-elevated shadow-sm transition-transform ${
                  settings.keepOriginalPhotos
                    ? "translate-x-5"
                    : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </Card>

      {/* ── Notifications ── */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-text-heading">
          Notifications
        </h2>
        <div className="mt-3 space-y-4">
          {/* Enable/disable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-text-secondary">
                Enable Notifications
              </span>
              <p className="text-xs text-text-muted">
                Get reminders for tasks and frost warnings
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notifications.enabled}
              onClick={() => {
                if (notifications.enabled) {
                  notifications.disable();
                } else {
                  void notifications.enable().then((ok) => {
                    if (!ok) toast("Notification permission denied by browser", "error");
                  });
                }
              }}
              disabled={!notifications.supported}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                notifications.enabled ? "bg-primary" : "bg-border-strong"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-surface-elevated shadow-sm transition-transform ${
                  notifications.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Permission status */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Status:</span>
            {!notifications.supported ? (
              <Badge>Not Supported</Badge>
            ) : notifications.permitted ? (
              <Badge variant="success">Granted</Badge>
            ) : (
              <Badge variant="warning">Not Granted</Badge>
            )}
          </div>

          {/* iOS info */}
          {notifications.isIOS && (
            <div className="rounded-lg border border-border-strong bg-surface-muted p-3">
              <p className="text-xs text-text-secondary">
                iOS does not support web notifications. You&apos;ll see
                in-app reminders on your dashboard instead.
              </p>
            </div>
          )}

          {/* Reset prompt */}
          {notifications.dismissed && !notifications.enabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                notifications.resetPrompt();
                toast("Notification prompt reset", "success");
              }}
            >
              Reset notification prompt
            </Button>
          )}
        </div>
      </Card>

      {/* ── Seasons ── */}
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-text-heading">
            Seasons
          </h2>
          <div className="flex items-center gap-2">
            {seasons && seasons.length >= 2 && (
              <Link
                to="/seasons/compare"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-heading transition-colors hover:bg-surface-muted"
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
          <div className="mt-4 space-y-3 rounded-lg border border-border-default bg-surface p-3">
            <div>
              <label htmlFor="season-name" className="mb-1 block text-sm font-medium text-text-secondary">
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
              <label htmlFor="season-year" className="mb-1 block text-sm font-medium text-text-secondary">
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
                <label htmlFor="season-start" className="mb-1 block text-sm font-medium text-text-secondary">
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
                <label htmlFor="season-end" className="mb-1 block text-sm font-medium text-text-secondary">
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
            <p className="text-sm text-text-muted">No seasons yet. Create one to get started.</p>
          ) : (
            seasons.map((season) => (
              <div
                key={season.id}
                className={`rounded-lg border p-3 ${
                  season.isActive
                    ? "border-focus-ring bg-status-success-bg"
                    : "border-border-default bg-surface"
                }`}
              >
                {editSeasonId === season.id ? (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor={`edit-season-name-${season.id}`} className="mb-1 block text-sm font-medium text-text-secondary">
                        Name
                      </label>
                      <Input
                        id={`edit-season-name-${season.id}`}
                        type="text"
                        value={editSeason.name}
                        onChange={(e) => setEditSeason((s) => ({ ...s, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label htmlFor={`edit-season-year-${season.id}`} className="mb-1 block text-sm font-medium text-text-secondary">
                        Year
                      </label>
                      <Input
                        id={`edit-season-year-${season.id}`}
                        type="number"
                        value={String(editSeason.year)}
                        onChange={(e) => setEditSeason((s) => ({ ...s, year: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor={`edit-season-start-${season.id}`} className="mb-1 block text-sm font-medium text-text-secondary">
                          Start Date
                        </label>
                        <Input
                          id={`edit-season-start-${season.id}`}
                          type="date"
                          value={editSeason.startDate}
                          onChange={(e) => setEditSeason((s) => ({ ...s, startDate: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label htmlFor={`edit-season-end-${season.id}`} className="mb-1 block text-sm font-medium text-text-secondary">
                          End Date
                        </label>
                        <Input
                          id={`edit-season-end-${season.id}`}
                          type="date"
                          value={editSeason.endDate}
                          onChange={(e) => setEditSeason((s) => ({ ...s, endDate: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => void handleUpdateSeason()}>
                        Save
                      </Button>
                      <Button variant="ghost" onClick={() => setEditSeasonId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">{season.name}</span>
                        <span className="text-sm text-text-secondary">{String(season.year)}</span>
                        {season.isActive && <Badge variant="success">Active</Badge>}
                      </div>
                      <p className="text-xs text-text-muted">
                        {season.startDate} &ndash; {season.endDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        onClick={() => startEditSeason(season)}
                      >
                        Edit
                      </Button>
                      {!season.isActive && (
                        <Button
                          variant="ghost"
                          onClick={() => void handleSetActive(season.id)}
                        >
                          Set Active
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        className="text-terracotta-600 hover:bg-terracotta-400/10"
                        onClick={() => setDeleteSeasonId(season.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Delete season confirmation dialog */}
      {deleteSeasonId != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-soil-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-season-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteSeasonId(null);
          }}
        >
          <Card className="w-full max-w-sm">
            <h3
              id="delete-season-dialog-title"
              className="font-display text-lg font-semibold text-text-primary"
            >
              Delete {deleteSeasonName}?
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              This season will be removed. This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setDeleteSeasonId(null)}
                disabled={deletingSeason}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-accent hover:bg-accent-hover"
                onClick={() => void handleDeleteSeason()}
                disabled={deletingSeason}
              >
                {deletingSeason ? "Deleting\u2026" : "Delete"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Jninty Cloud Sync (SaaS) ── */}
      <CloudSyncSettings />

      {/* ── Multi-Device Sync (hidden for cloud users) ── */}
      {!isCloudUser && <Card>
        <h2 className="font-display text-lg font-semibold text-text-heading">
          Multi-Device Sync
        </h2>
        <p className="mt-1 text-xs text-text-muted">
          Sync your garden data across devices via CouchDB
        </p>

        <div className="mt-4 space-y-4">
          {/* Status row */}
          <div className="flex items-center justify-between rounded-lg border border-border-default bg-surface p-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  syncStatus === "syncing"
                    ? "bg-blue-500 animate-pulse"
                    : syncStatus === "paused"
                      ? "bg-green-500"
                      : syncStatus === "error"
                        ? "bg-red-500"
                        : syncStatus === "offline"
                          ? "bg-amber-500"
                          : "bg-soil-400"
                }`}
              />
              <span className="text-sm font-medium text-text-primary">
                {syncStatus === "syncing"
                  ? "Syncing..."
                  : syncStatus === "paused"
                    ? "Connected"
                    : syncStatus === "error"
                      ? "Error"
                      : syncStatus === "offline"
                        ? "Offline"
                        : "Disabled"}
              </span>
            </div>
            {lastSynced && (
              <span className="text-xs text-text-muted">
                Last synced: {new Date(lastSynced).toLocaleString()}
              </span>
            )}
          </div>

          {/* CouchDB URL */}
          <div>
            <label
              htmlFor="sync-url"
              className="mb-1 block text-sm font-medium text-text-secondary"
            >
              CouchDB Server URL
            </label>
            <Input
              id="sync-url"
              type="url"
              placeholder="http://192.168.1.50:5984/jninty"
              value={syncUrl}
              onChange={(e) => setSyncUrl(e.target.value)}
            />
          </div>

          {/* Credentials */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="sync-username"
                className="mb-1 block text-sm font-medium text-text-secondary"
              >
                Username
              </label>
              <Input
                id="sync-username"
                type="text"
                placeholder="admin"
                value={syncUsername}
                onChange={(e) => setSyncUsername(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="sync-password"
                className="mb-1 block text-sm font-medium text-text-secondary"
              >
                Password
              </label>
              <Input
                id="sync-password"
                type="password"
                placeholder="password"
                value={syncPassword}
                onChange={(e) => setSyncPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Test connection */}
          <div>
            <Button
              variant="secondary"
              onClick={() => void handleTestConnection()}
              disabled={testBusy || !syncUrl.trim()}
            >
              {testBusy ? "Testing..." : "Test Connection"}
            </Button>
            {testResult && (
              <p className="mt-1 text-sm text-text-heading">
                Connected to <strong>{testResult.dbName}</strong> ({String(testResult.docCount)} docs)
              </p>
            )}
            {testError && (
              <p className="mt-1 text-sm text-red-600">{testError}</p>
            )}
          </div>

          {/* Start / Stop / Sync Now buttons */}
          <div className="flex flex-wrap gap-2">
            {syncStatus === "disabled" || !syncConfigured ? (
              <Button
                onClick={handleStartSync}
                disabled={!syncUrl.trim()}
              >
                Start Sync
              </Button>
            ) : (
              <Button variant="secondary" onClick={handleStopSync}>
                Stop Sync
              </Button>
            )}
            {syncStatus === "paused" && (
              <Button variant="ghost" onClick={handleSyncNow}>
                Sync Now
              </Button>
            )}
            {(syncConfigured || syncUrl.trim()) && (
              <Button variant="ghost" onClick={handleClearSync}>
                Clear Config
              </Button>
            )}
          </div>
        </div>
      </Card>}

      {/* ── Data Management ── */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-text-heading">
          Data Management
        </h2>

        <div className="mt-4 space-y-4">
          {/* Storage dashboard */}
          <div>
            <span className="mb-2 block text-sm font-medium text-text-secondary">
              Storage
            </span>
            {storage ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-secondary">
                  <span>Thumbnails: {formatBytes(storage.thumbnailBytes)}</span>
                  <span>Display: {formatBytes(storage.displayBytes)}</span>
                  <span>Originals: {formatBytes(storage.originalBytes)}</span>
                  <span>Data: {formatBytes(storage.dataBytes)}</span>
                </div>
                {remoteInfo && remoteInfo.diskSize > 0 ? (
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-medium text-text-primary">
                    <span>Local: {formatBytes(storage.totalBytes)}</span>
                    <span>Remote (CouchDB): {formatBytes(remoteInfo.diskSize)}</span>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-text-primary">
                    Total: {formatBytes(storage.totalBytes)}
                  </p>
                )}
                {storage.quotaBytes > 0 && (
                  <div>
                    <div className="h-2 w-full rounded-full bg-surface-muted">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{
                          width: `${String(Math.min(100, (storage.totalBytes / storage.quotaBytes) * 100))}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      {formatBytes(storage.totalBytes)} of{" "}
                      {formatBytes(storage.quotaBytes)} used
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-muted">Calculating…</p>
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
              <p className="mt-1 text-xs text-text-muted">
                Last export:{" "}
                {new Date(settings.lastExportDate).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Import */}
          <div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowImportDialog(true)}
              >
                Import Jninty Backup
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowCsvDialog(true)}
              >
                Import Plants from CSV
              </Button>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              Restore from a backup ZIP or import plants from a CSV file
            </p>
          </div>

          {/* Demo data */}
          <div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => void handleLoadDemo()}
                disabled={demoBusy || clearDemoBusy}
              >
                {demoBusy ? "Loading…" : "Load Demo Data"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => void handleClearDemo()}
                disabled={demoBusy || clearDemoBusy}
                className="text-red-600 hover:text-red-700"
              >
                {clearDemoBusy ? "Clearing…" : "Clear All Data"}
              </Button>
            </div>
            {demoError && (
              <p className="mt-1 text-sm text-red-600">{demoError}</p>
            )}
            <p className="mt-1 text-xs text-text-muted">
              Load sample plants, journal entries, tasks, and more for
              exploration. Clear removes all data from the app.
            </p>
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
            <p className="mt-1 text-xs text-text-muted">
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
              <p className="mt-1 text-sm text-text-secondary">
                Indexed {String(rebuildCount)} items.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* ── App version ── */}
      <p className="text-center text-xs text-text-muted">
        Jninty v{__APP_VERSION__}
      </p>

      {/* Import dialogs */}
      <ImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
      />
      <CsvImportDialog
        open={showCsvDialog}
        onClose={() => setShowCsvDialog(false)}
      />

      {/* End-of-season review modal */}
      {showEndOfSeason && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEndOfSeason(false);
          }}
        >
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface-elevated p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-text-heading">
              End of Season Review
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              How did each planting do this season? Set outcomes before starting
              a new season.
            </p>

            <div className="mt-4 space-y-3">
              {endOfSeasonPlantings.map((planting) => (
                <div
                  key={planting.id}
                  className="flex items-center justify-between rounded-lg border border-border-default bg-surface p-3"
                >
                  <span className="text-sm font-medium text-text-primary">
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
                            : "bg-surface-muted text-text-secondary hover:bg-surface-muted"
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
