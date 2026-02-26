import { describe, it, expect } from "vitest";
import { settingsSchema } from "./settings.schema.ts";
import { validateEntity } from "./helpers.ts";

const validSettings = {
  growingZone: "7b",
  lastFrostDate: "2026-04-15",
  firstFrostDate: "2026-10-20",
  gridUnit: "feet" as const,
  temperatureUnit: "fahrenheit" as const,
  theme: "light" as const,
  keepOriginalPhotos: false,
  dbSchemaVersion: 1,
  exportVersion: 1,
};

describe("settingsSchema", () => {
  it("accepts valid settings", () => {
    const result = validateEntity(settingsSchema, validSettings);
    expect(result.success).toBe(true);
  });

  it("accepts settings with gardenName", () => {
    const result = validateEntity(settingsSchema, {
      ...validSettings,
      gardenName: "Ahmed's Garden",
    });
    expect(result.success).toBe(true);
  });

  it("accepts celsius temperature unit", () => {
    const result = validateEntity(settingsSchema, {
      ...validSettings,
      temperatureUnit: "celsius",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all theme values", () => {
    for (const theme of ["light", "dark", "auto"]) {
      const result = validateEntity(settingsSchema, {
        ...validSettings,
        theme,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects empty growingZone", () => {
    const result = validateEntity(settingsSchema, {
      ...validSettings,
      growingZone: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format for lastFrostDate", () => {
    const result = validateEntity(settingsSchema, {
      ...validSettings,
      lastFrostDate: "April 15, 2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects ISO datetime for frost dates (expects date only)", () => {
    const result = validateEntity(settingsSchema, {
      ...validSettings,
      lastFrostDate: "2026-04-15T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid temperatureUnit", () => {
    const result = validateEntity(settingsSchema, {
      ...validSettings,
      temperatureUnit: "kelvin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid theme", () => {
    const result = validateEntity(settingsSchema, {
      ...validSettings,
      theme: "sepia",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero dbSchemaVersion", () => {
    const result = validateEntity(settingsSchema, {
      ...validSettings,
      dbSchemaVersion: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative exportVersion", () => {
    const result = validateEntity(settingsSchema, {
      ...validSettings,
      exportVersion: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects fractional dbSchemaVersion", () => {
    const result = validateEntity(settingsSchema, {
      ...validSettings,
      dbSchemaVersion: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean keepOriginalPhotos", () => {
    const result = validateEntity(settingsSchema, {
      ...validSettings,
      keepOriginalPhotos: "yes",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty gardenName", () => {
    const result = validateEntity(settingsSchema, {
      ...validSettings,
      gardenName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = validateEntity(settingsSchema, {});
    expect(result.success).toBe(false);
  });

  it("accepts settings with latitude and longitude", () => {
    const result = validateEntity(settingsSchema, {
      ...validSettings,
      latitude: 45.5231,
      longitude: -122.6765,
    });
    expect(result.success).toBe(true);
  });

  it("accepts settings without latitude and longitude (optional)", () => {
    const result = validateEntity(settingsSchema, validSettings);
    expect(result.success).toBe(true);
  });

  it("rejects latitude out of range (> 90)", () => {
    const result = validateEntity(settingsSchema, {
      ...validSettings,
      latitude: 91,
    });
    expect(result.success).toBe(false);
  });

  it("rejects latitude out of range (< -90)", () => {
    const result = validateEntity(settingsSchema, {
      ...validSettings,
      latitude: -91,
    });
    expect(result.success).toBe(false);
  });

  it("rejects longitude out of range (> 180)", () => {
    const result = validateEntity(settingsSchema, {
      ...validSettings,
      longitude: 181,
    });
    expect(result.success).toBe(false);
  });

  it("rejects longitude out of range (< -180)", () => {
    const result = validateEntity(settingsSchema, {
      ...validSettings,
      longitude: -181,
    });
    expect(result.success).toBe(false);
  });

  it("accepts boundary latitude values", () => {
    for (const lat of [-90, 0, 90]) {
      const result = validateEntity(settingsSchema, {
        ...validSettings,
        latitude: lat,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts boundary longitude values", () => {
    for (const lon of [-180, 0, 180]) {
      const result = validateEntity(settingsSchema, {
        ...validSettings,
        longitude: lon,
      });
      expect(result.success).toBe(true);
    }
  });
});
