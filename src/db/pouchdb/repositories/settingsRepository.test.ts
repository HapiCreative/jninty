import { describe, it, expect, beforeEach, vi } from "vitest";
import PouchDB from "pouchdb";
import PouchDBFind from "pouchdb-find";
import PouchDBAdapterMemory from "pouchdb-adapter-memory";

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(PouchDBAdapterMemory);

let testDB: PouchDB.Database;

vi.mock("../client.ts", () => ({
  get localDB() {
    return testDB;
  },
}));

const settingsRepo = await import("./settingsRepository.ts");

const baseSettings = {
  growingZone: "7b",
  lastFrostDate: "2026-04-15",
  firstFrostDate: "2026-10-20",
  gridUnit: "feet" as const,
  temperatureUnit: "fahrenheit" as const,
  theme: "light" as const,
  keepOriginalPhotos: false,
  dbSchemaVersion: 7,
  exportVersion: 1,
};

beforeEach(async () => {
  testDB = new PouchDB(`test-settings-${crypto.randomUUID()}`, {
    adapter: "memory",
  });
});

describe("PouchDB settingsRepository", () => {
  describe("get", () => {
    it("returns undefined when no settings exist", async () => {
      const settings = await settingsRepo.get();
      expect(settings).toBeUndefined();
    });

    it("returns settings after they are created", async () => {
      await settingsRepo.update(baseSettings);
      const settings = await settingsRepo.get();

      expect(settings).toBeDefined();
      expect(settings?.growingZone).toBe("7b");
    });

    it("does not include PouchDB fields", async () => {
      await settingsRepo.update(baseSettings);
      const settings = await settingsRepo.get();

      expect(
        (settings as Record<string, unknown>)["_id"],
      ).toBeUndefined();
      expect(
        (settings as Record<string, unknown>)["_rev"],
      ).toBeUndefined();
      expect(
        (settings as Record<string, unknown>)["docType"],
      ).toBeUndefined();
    });
  });

  describe("update", () => {
    it("creates settings on first call", async () => {
      const settings = await settingsRepo.update(baseSettings);

      expect(settings.growingZone).toBe("7b");
      expect(settings.theme).toBe("light");
    });

    it("merges changes on subsequent calls", async () => {
      await settingsRepo.update(baseSettings);
      const updated = await settingsRepo.update({ theme: "dark" });

      expect(updated.theme).toBe("dark");
      expect(updated.growingZone).toBe("7b"); // preserved
    });

    it("can add optional fields", async () => {
      await settingsRepo.update(baseSettings);
      const updated = await settingsRepo.update({
        gardenName: "My Garden",
        latitude: 40.7128,
        longitude: -74.006,
      });

      expect(updated.gardenName).toBe("My Garden");
      expect(updated.latitude).toBe(40.7128);
    });
  });

  describe("clearLocation", () => {
    it("removes latitude and longitude", async () => {
      await settingsRepo.update({
        ...baseSettings,
        latitude: 40.7128,
        longitude: -74.006,
      });

      const cleared = await settingsRepo.clearLocation();
      expect(cleared.latitude).toBeUndefined();
      expect(cleared.longitude).toBeUndefined();
      expect(cleared.growingZone).toBe("7b"); // other fields preserved
    });

    it("throws when settings not initialized", async () => {
      await expect(settingsRepo.clearLocation()).rejects.toThrow(
        "Settings not initialized",
      );
    });
  });
});
