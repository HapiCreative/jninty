import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Settings } from "../validation/settings.schema.ts";
import { settingsRepository } from "../db/index.ts";

const DEFAULT_SETTINGS: Settings = {
  growingZone: "7a",
  lastFrostDate: "2026-04-15",
  firstFrostDate: "2026-10-15",
  gridUnit: "feet",
  temperatureUnit: "fahrenheit",
  theme: "light",
  highContrast: false,
  fontSize: "normal",
  keepOriginalPhotos: false,
  dbSchemaVersion: 1,
  exportVersion: 1,
};

type SettingsContextValue = {
  settings: Settings;
  loading: boolean;
  updateSettings: (changes: Partial<Settings>) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await settingsRepository.get();
      if (cancelled) return;
      if (stored) {
        setSettings(stored);
      } else {
        const initialized = await settingsRepository.update(DEFAULT_SETTINGS);
        if (!cancelled) setSettings(initialized);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback(
    async (changes: Partial<Settings>) => {
      const updated = await settingsRepository.update(changes);
      setSettings(updated);
    },
    [],
  );

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}
