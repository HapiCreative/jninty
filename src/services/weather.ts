import { localDB } from "../db/pouchdb/client.ts";

// ─── Types ───

export type WeatherData = {
  currentTempC: number;
  conditions: string;
  conditionCode: number;
  highC: number;
  lowC: number;
  precipitationMm: number;
  humidity: number;
  frostWarning: boolean;
  isDay: boolean;
};

export type GeoSearchResult = {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
};

// ─── WMO weather code mapping ───

const WMO_CONDITIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Light freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Heavy showers",
  85: "Light snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm",
};

export function getConditionLabel(code: number): string {
  return WMO_CONDITIONS[code] ?? "Unknown";
}

export function getConditionEmoji(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? "\u2600\uFE0F" : "\uD83C\uDF19";
  if (code <= 3) return isDay ? "\u26C5" : "\uD83C\uDF19";
  if (code <= 48) return "\uD83C\uDF2B\uFE0F";
  if (code <= 57) return "\uD83C\uDF27\uFE0F";
  if (code <= 65) return "\uD83C\uDF27\uFE0F";
  if (code <= 67) return "\u2744\uFE0F\uD83C\uDF27\uFE0F";
  if (code <= 77) return "\uD83C\uDF28\uFE0F";
  if (code <= 82) return "\uD83C\uDF26\uFE0F";
  if (code <= 86) return "\uD83C\uDF28\uFE0F";
  return "\u26C8\uFE0F";
}

// ─── Temperature conversion ───

export function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

export function formatTemp(
  tempC: number,
  unit: "fahrenheit" | "celsius",
): string {
  if (unit === "fahrenheit") {
    return `${String(celsiusToFahrenheit(tempC))}\u00B0F`;
  }
  return `${String(Math.round(tempC))}\u00B0C`;
}

// ─── API response types ───

type OpenMeteoResponse = {
  current_weather: {
    temperature: number;
    weathercode: number;
    is_day: 0 | 1;
  };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
  };
  hourly: {
    relative_humidity_2m: number[];
  };
};

type GeocodingResponse = {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    admin1?: string;
  }>;
};

// ─── Cache config ───

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_DOC_ID = "weatherCache:current";

// In-memory cache for instant reads within a session.
let memoryCache: {
  data: WeatherData;
  fetchedAt: number;
  latitude: number;
  longitude: number;
} | null = null;

// ─── Core API function ───

async function fetchFromApi(
  latitude: number,
  longitude: number,
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current_weather: "true",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
    hourly: "relative_humidity_2m",
    forecast_days: "1",
    timezone: "auto",
  });

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Weather API error: ${String(response.status)}`);
  }

  const json = (await response.json()) as OpenMeteoResponse;

  const currentHour = new Date().getHours();
  const humidity = json.hourly.relative_humidity_2m[currentHour] ?? 0;
  const highC = json.daily.temperature_2m_max[0] ?? 0;
  const lowC = json.daily.temperature_2m_min[0] ?? 0;
  const precipitationMm = json.daily.precipitation_sum[0] ?? 0;

  return {
    currentTempC: json.current_weather.temperature,
    conditions: getConditionLabel(json.current_weather.weathercode),
    conditionCode: json.current_weather.weathercode,
    highC,
    lowC,
    precipitationMm,
    humidity,
    frostWarning: lowC <= 0,
    isDay: json.current_weather.is_day === 1,
  };
}

// ─── Cache helpers ───

type WeatherCacheDoc = PouchDB.Core.IdMeta &
  PouchDB.Core.GetMeta & {
    docType: string;
    data: string;
    fetchedAt: string;
  };

async function readCache(
  latitude: number,
  longitude: number,
): Promise<WeatherData | null> {
  // Check memory cache first — must match coordinates
  if (
    memoryCache &&
    memoryCache.latitude === latitude &&
    memoryCache.longitude === longitude &&
    Date.now() - memoryCache.fetchedAt < CACHE_TTL_MS
  ) {
    return memoryCache.data;
  }

  // Fall back to PouchDB
  try {
    const record = await localDB.get<WeatherCacheDoc>(CACHE_DOC_ID);

    const parsed = JSON.parse(record.data) as {
      weather: WeatherData;
      latitude: number;
      longitude: number;
    };

    // Verify coordinates match
    if (parsed.latitude !== latitude || parsed.longitude !== longitude) {
      return null;
    }

    const fetchedAt = new Date(record.fetchedAt).getTime();
    if (Date.now() - fetchedAt >= CACHE_TTL_MS) return null;

    memoryCache = {
      data: parsed.weather,
      fetchedAt,
      latitude,
      longitude,
    };
    return parsed.weather;
  } catch {
    return null;
  }
}

async function writeCache(
  data: WeatherData,
  latitude: number,
  longitude: number,
): Promise<void> {
  const now = Date.now();
  memoryCache = { data, fetchedAt: now, latitude, longitude };

  try {
    // Get existing _rev for update, if the doc exists
    let rev: string | undefined;
    try {
      const existing = await localDB.get(CACHE_DOC_ID);
      rev = existing._rev;
    } catch {
      // Doc doesn't exist yet — that's fine, we'll create it
    }

    await localDB.put({
      _id: CACHE_DOC_ID,
      ...(rev ? { _rev: rev } : {}),
      docType: "weatherCache",
      data: JSON.stringify({ weather: data, latitude, longitude }),
      fetchedAt: new Date(now).toISOString(),
    });
  } catch {
    // Cache write failure is non-critical
  }
}

// ─── Public API ───

/**
 * Fetch current weather for the given coordinates.
 * Returns cached data if fresh (< 1 hour old).
 * Returns null if offline or API fails (graceful degradation).
 */
export async function fetchCurrentWeather(
  latitude: number,
  longitude: number,
): Promise<WeatherData | null> {
  // Check cache (coordinate-aware)
  const cached = await readCache(latitude, longitude);
  if (cached) return cached;

  // Fetch fresh data
  try {
    const data = await fetchFromApi(latitude, longitude);
    await writeCache(data, latitude, longitude);
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch a lightweight weather snapshot for journal entry auto-capture.
 * Returns the subset of data matching WeatherSnapshot schema.
 */
export async function fetchWeatherSnapshot(
  latitude: number,
  longitude: number,
): Promise<{ tempC: number; humidity: number; conditions: string } | null> {
  const weather = await fetchCurrentWeather(latitude, longitude);
  if (!weather) return null;
  return {
    tempC: weather.currentTempC,
    humidity: weather.humidity,
    conditions: weather.conditions,
  };
}

/**
 * Search for locations by name using Open-Meteo geocoding API.
 */
export async function searchLocation(
  query: string,
): Promise<GeoSearchResult[]> {
  if (!query.trim()) return [];

  try {
    const params = new URLSearchParams({
      name: query.trim(),
      count: "5",
      language: "en",
      format: "json",
    });

    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`,
    );

    if (!response.ok) return [];

    const json = (await response.json()) as GeocodingResponse;
    if (!json.results) return [];

    return json.results.map((r) => ({
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      country: r.country,
      ...(r.admin1 ? { admin1: r.admin1 } : {}),
    }));
  } catch {
    return [];
  }
}

/**
 * Invalidate the weather cache (e.g. when location changes).
 */
export async function clearWeatherCache(): Promise<void> {
  memoryCache = null;
  try {
    const doc = await localDB.get(CACHE_DOC_ID);
    await localDB.remove(doc);
  } catch {
    // Non-critical
  }
}
