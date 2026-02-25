import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../schema.ts";
import * as settingsRepo from "./settingsRepository.ts";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const defaultSettings = {
  growingZone: "7b",
  lastFrostDate: "2026-04-15",
  firstFrostDate: "2026-10-20",
  temperatureUnit: "fahrenheit" as const,
  theme: "light" as const,
  keepOriginalPhotos: false,
  dbSchemaVersion: 1,
  exportVersion: 1,
};

describe("settingsRepository", () => {
  describe("get", () => {
    it("returns undefined when no settings exist", async () => {
      const settings = await settingsRepo.get();
      expect(settings).toBeUndefined();
    });

    it("returns settings without the id wrapper", async () => {
      await settingsRepo.update(defaultSettings);
      const settings = await settingsRepo.get();

      expect(settings).toBeDefined();
      expect(settings?.growingZone).toBe("7b");
      // Should not expose the internal id
      expect((settings as Record<string, unknown>)?.["id"]).toBeUndefined();
    });
  });

  describe("update", () => {
    it("creates settings on first write", async () => {
      const settings = await settingsRepo.update(defaultSettings);

      expect(settings.growingZone).toBe("7b");
      expect(settings.theme).toBe("light");
    });

    it("merges partial updates with existing settings", async () => {
      await settingsRepo.update(defaultSettings);
      const updated = await settingsRepo.update({
        theme: "dark",
        gardenName: "My Garden",
      });

      expect(updated.theme).toBe("dark");
      expect(updated.gardenName).toBe("My Garden");
      expect(updated.growingZone).toBe("7b"); // preserved
    });

    it("validates the merged result", async () => {
      // Creating without all required fields should throw
      await expect(
        settingsRepo.update({ theme: "dark" }),
      ).rejects.toThrow();
    });

    it("uses singleton pattern — only one record", async () => {
      await settingsRepo.update(defaultSettings);
      await settingsRepo.update({ theme: "dark" });

      const count = await db.settings.count();
      expect(count).toBe(1);
    });
  });
});
