import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "../db/schema.ts";
import {
  getConditionLabel,
  getConditionEmoji,
  celsiusToFahrenheit,
  formatTemp,
  fetchCurrentWeather,
  fetchWeatherSnapshot,
  searchLocation,
  clearWeatherCache,
} from "./weather.ts";

// ─── Unit tests (no API calls) ───

describe("getConditionLabel", () => {
  it("returns 'Clear sky' for code 0", () => {
    expect(getConditionLabel(0)).toBe("Clear sky");
  });

  it("returns 'Partly cloudy' for code 2", () => {
    expect(getConditionLabel(2)).toBe("Partly cloudy");
  });

  it("returns 'Rain' for code 63", () => {
    expect(getConditionLabel(63)).toBe("Rain");
  });

  it("returns 'Thunderstorm' for code 95", () => {
    expect(getConditionLabel(95)).toBe("Thunderstorm");
  });

  it("returns 'Unknown' for unrecognized code", () => {
    expect(getConditionLabel(999)).toBe("Unknown");
  });
});

describe("getConditionEmoji", () => {
  it("returns sun emoji for clear sky during day", () => {
    expect(getConditionEmoji(0, true)).toBe("\u2600\uFE0F");
  });

  it("returns moon emoji for clear sky at night", () => {
    expect(getConditionEmoji(0, false)).toBe("\uD83C\uDF19");
  });

  it("returns cloud emoji for partly cloudy day", () => {
    expect(getConditionEmoji(2, true)).toBe("\u26C5");
  });

  it("returns rain emoji for rain codes", () => {
    expect(getConditionEmoji(63, true)).toBe("\uD83C\uDF27\uFE0F");
  });

  it("returns snow emoji for snow codes", () => {
    expect(getConditionEmoji(73, true)).toBe("\uD83C\uDF28\uFE0F");
  });

  it("returns thunderstorm emoji for code 95+", () => {
    expect(getConditionEmoji(95, true)).toBe("\u26C8\uFE0F");
  });
});

describe("celsiusToFahrenheit", () => {
  it("converts 0°C to 32°F", () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
  });

  it("converts 100°C to 212°F", () => {
    expect(celsiusToFahrenheit(100)).toBe(212);
  });

  it("converts -40°C to -40°F", () => {
    expect(celsiusToFahrenheit(-40)).toBe(-40);
  });

  it("rounds to nearest integer", () => {
    expect(celsiusToFahrenheit(22.5)).toBe(73);
  });
});

describe("formatTemp", () => {
  it("formats celsius correctly", () => {
    expect(formatTemp(22.3, "celsius")).toBe("22\u00B0C");
  });

  it("formats fahrenheit correctly", () => {
    expect(formatTemp(0, "fahrenheit")).toBe("32\u00B0F");
  });

  it("rounds celsius display", () => {
    expect(formatTemp(22.7, "celsius")).toBe("23\u00B0C");
  });
});

// ─── Frost warning detection ───

describe("frost warning", () => {
  const makeApiResponse = (lowC: number) =>
    JSON.stringify({
      current_weather: { temperature: 5, weathercode: 0, is_day: 1 },
      daily: {
        temperature_2m_max: [10],
        temperature_2m_min: [lowC],
        precipitation_sum: [0],
      },
      hourly: { relative_humidity_2m: Array.from({ length: 24 }, () => 50) },
    });

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await clearWeatherCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets frostWarning true when low <= 0°C", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(makeApiResponse(-2), { status: 200 }),
    );
    const result = await fetchCurrentWeather(45, -122);
    expect(result).not.toBeNull();
    expect(result!.frostWarning).toBe(true);
  });

  it("sets frostWarning true when low is exactly 0°C", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(makeApiResponse(0), { status: 200 }),
    );
    const result = await fetchCurrentWeather(45, -122);
    expect(result).not.toBeNull();
    expect(result!.frostWarning).toBe(true);
  });

  it("sets frostWarning false when low > 0°C", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(makeApiResponse(3), { status: 200 }),
    );
    const result = await fetchCurrentWeather(45, -122);
    expect(result).not.toBeNull();
    expect(result!.frostWarning).toBe(false);
  });
});

// ─── API response parsing ───

describe("fetchCurrentWeather", () => {
  const validApiResponse = JSON.stringify({
    current_weather: { temperature: 18.5, weathercode: 2, is_day: 1 },
    daily: {
      temperature_2m_max: [22.0],
      temperature_2m_min: [8.3],
      precipitation_sum: [1.2],
    },
    hourly: {
      relative_humidity_2m: Array.from({ length: 24 }, () => 65),
    },
  });

  beforeEach(async () => {
    await db.delete();
    await db.open();
    await clearWeatherCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses API response correctly", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(validApiResponse, { status: 200 }),
    );

    const result = await fetchCurrentWeather(45.5, -122.6);
    expect(result).not.toBeNull();
    expect(result!.currentTempC).toBe(18.5);
    expect(result!.conditions).toBe("Partly cloudy");
    expect(result!.conditionCode).toBe(2);
    expect(result!.highC).toBe(22.0);
    expect(result!.lowC).toBe(8.3);
    expect(result!.precipitationMm).toBe(1.2);
    expect(result!.humidity).toBe(65);
    expect(result!.isDay).toBe(true);
    expect(result!.frostWarning).toBe(false);
  });

  it("returns null when offline / fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    const result = await fetchCurrentWeather(45.5, -122.6);
    expect(result).toBeNull();
  });

  it("returns null when API returns error status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Server error", { status: 500 }),
    );

    const result = await fetchCurrentWeather(45.5, -122.6);
    expect(result).toBeNull();
  });

  it("returns cached data on second call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(validApiResponse, { status: 200 }),
    );

    const first = await fetchCurrentWeather(45.5, -122.6);
    expect(first).not.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const second = await fetchCurrentWeather(45.5, -122.6);
    expect(second).toEqual(first);
    // Should not have fetched again — served from cache
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

// ─── Weather snapshot for journal ───

describe("fetchWeatherSnapshot", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await clearWeatherCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns subset of weather data for journal entries", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          current_weather: { temperature: 20, weathercode: 0, is_day: 1 },
          daily: {
            temperature_2m_max: [25],
            temperature_2m_min: [15],
            precipitation_sum: [0],
          },
          hourly: {
            relative_humidity_2m: Array.from({ length: 24 }, () => 55),
          },
        }),
        { status: 200 },
      ),
    );

    const snapshot = await fetchWeatherSnapshot(45, -122);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.tempC).toBe(20);
    expect(snapshot!.humidity).toBe(55);
    expect(snapshot!.conditions).toBe("Clear sky");
  });

  it("returns null when fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    const snapshot = await fetchWeatherSnapshot(45, -122);
    expect(snapshot).toBeNull();
  });
});

// ─── Geocoding search ───

describe("searchLocation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns location results", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            {
              name: "Portland",
              latitude: 45.5231,
              longitude: -122.6765,
              country: "United States",
              admin1: "Oregon",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const results = await searchLocation("Portland");
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe("Portland");
    expect(results[0]!.latitude).toBe(45.5231);
    expect(results[0]!.country).toBe("United States");
    expect(results[0]!.admin1).toBe("Oregon");
  });

  it("returns empty array for empty query", async () => {
    const results = await searchLocation("");
    expect(results).toEqual([]);
  });

  it("returns empty array when API fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    const results = await searchLocation("Portland");
    expect(results).toEqual([]);
  });

  it("returns empty array when no results found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    const results = await searchLocation("xyznonexistent");
    expect(results).toEqual([]);
  });
});
