import "fake-indexeddb/auto";
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { clearPouchDB } from "../db/pouchdb/testUtils.ts";
import { settingsRepository as settingsRepo } from "../db/index.ts";
import { SettingsProvider, useSettings } from "./useSettings.tsx";

beforeEach(async () => {
  await clearPouchDB();
});

function wrapper({ children }: { children: ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}

describe("useSettings", () => {
  it("throws when used outside SettingsProvider", () => {
    expect(() => {
      renderHook(() => useSettings());
    }).toThrow("useSettings must be used within a SettingsProvider");
  });

  it("starts in loading state", () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.loading).toBe(true);
  });

  it("initializes defaults when no settings exist", async () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings.growingZone).toBe("7a");
    expect(result.current.settings.gridUnit).toBe("feet");
    expect(result.current.settings.temperatureUnit).toBe("fahrenheit");
    expect(result.current.settings.theme).toBe("light");

    // Verify defaults were persisted to DB
    const stored = await settingsRepo.get();
    expect(stored).toBeDefined();
    expect(stored?.growingZone).toBe("7a");
  });

  it("loads existing settings from DB", async () => {
    await settingsRepo.update({
      growingZone: "9b",
      lastFrostDate: "2026-03-01",
      firstFrostDate: "2026-11-15",
      gridUnit: "meters",
      temperatureUnit: "celsius",
      theme: "dark",
      keepOriginalPhotos: true,
      dbSchemaVersion: 1,
      exportVersion: 1,
    });

    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings.growingZone).toBe("9b");
    expect(result.current.settings.gridUnit).toBe("meters");
    expect(result.current.settings.temperatureUnit).toBe("celsius");
    expect(result.current.settings.theme).toBe("dark");
  });

  it("updateSettings writes to DB and updates context", async () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateSettings({ theme: "dark" });
    });

    expect(result.current.settings.theme).toBe("dark");

    // Verify persisted
    const stored = await settingsRepo.get();
    expect(stored?.theme).toBe("dark");
  });

  it("updateSettings merges partial changes", async () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateSettings({ gridUnit: "meters" });
    });

    // gridUnit changed, others preserved
    expect(result.current.settings.gridUnit).toBe("meters");
    expect(result.current.settings.growingZone).toBe("7a");
    expect(result.current.settings.theme).toBe("light");
  });
});
