import { useState, useEffect } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Skeleton from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { useSettings } from "../hooks/useSettings";
import {
  getStorageUsage,
  formatBytes,
  type StorageUsage,
} from "../services/storageUsage";
import { exportAll, triggerDownload } from "../services/exporter";
import { rebuildIndex } from "../db/search";

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

  // Sync gardenName from settings on load
  useEffect(() => {
    setGardenName(settings.gardenName ?? "");
  }, [settings.gardenName]);

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

  const handleExport = async () => {
    setExportBusy(true);
    setExportError(null);
    try {
      const blob = await exportAll();
      const date = new Date().toISOString().slice(0, 10);
      triggerDownload(blob, `jninty-export-${date}.zip`);
      toast("Export downloaded!", "success");
    } catch {
      setExportError("Export failed. Please try again.");
      toast("Export failed", "error");
    } finally {
      setExportBusy(false);
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
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-soil-600">
                <span>Photos: {formatBytes(storage.photosBytes)}</span>
                <span>Data: {formatBytes(storage.dataBytes)}</span>
                <span className="font-medium text-soil-800">
                  Total: {formatBytes(storage.totalBytes)}
                </span>
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
    </div>
  );
}
