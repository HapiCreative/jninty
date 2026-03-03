import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSettings } from "../hooks/useSettings";
import {
  fetchCurrentWeather,
  formatTemp,
  getConditionEmoji,
  type WeatherData,
} from "../services/weather";
import { checkAndNotifyFrost } from "../services/notifications.ts";
import Card from "./ui/Card";
import Skeleton from "./ui/Skeleton";

function WeatherFetcher({
  latitude,
  longitude,
  temperatureUnit,
}: {
  latitude: number;
  longitude: number;
  temperatureUnit: "fahrenheit" | "celsius";
}) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await fetchCurrentWeather(latitude, longitude);
      if (cancelled) return;
      if (data) {
        setWeather(data);
        checkAndNotifyFrost(data.frostWarning);
      } else {
        setUnavailable(true);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  if (loading) {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      </Card>
    );
  }

  if (unavailable || !weather) {
    return (
      <Card className="border-border-strong bg-brown-50/30">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{"\uD83C\uDF25\uFE0F"}</span>
          <p className="text-sm text-text-secondary">
            Weather unavailable — check your connection
          </p>
        </div>
      </Card>
    );
  }

  const emoji = getConditionEmoji(weather.conditionCode, weather.isDay);

  return (
    <div className="space-y-2">
      {weather.frostWarning && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{"\u2744\uFE0F"}</span>
            <div>
              <p className="text-sm font-bold text-red-800">Frost Warning</p>
              <p className="text-xs text-red-600">
                Tonight&apos;s low is{" "}
                {formatTemp(weather.lowC, temperatureUnit)} — protect sensitive
                plants
              </p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <div className="flex items-center gap-4">
          <span className="text-4xl">{emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-text-primary">
                {formatTemp(weather.currentTempC, temperatureUnit)}
              </span>
              <span className="text-sm text-text-secondary">
                {weather.conditions}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-secondary">
              <span>
                H: {formatTemp(weather.highC, temperatureUnit)} / L:{" "}
                {formatTemp(weather.lowC, temperatureUnit)}
              </span>
              {weather.precipitationMm > 0 && (
                <span>
                  {"\uD83D\uDCA7"} {String(weather.precipitationMm)}mm
                </span>
              )}
              <span>Humidity: {String(weather.humidity)}%</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function WeatherWidget() {
  const { settings } = useSettings();

  if (settings.latitude == null || settings.longitude == null) {
    return (
      <Link to="/settings" className="block">
        <Card className="border-border-strong bg-brown-50/30 transition-shadow hover:shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{"\uD83C\uDF24\uFE0F"}</span>
            <div>
              <p className="text-sm font-medium text-text-secondary">
                Set your location for weather
              </p>
              <p className="text-xs text-text-secondary">
                Tap to add your coordinates in Settings
              </p>
            </div>
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <WeatherFetcher
      latitude={settings.latitude}
      longitude={settings.longitude}
      temperatureUnit={settings.temperatureUnit}
    />
  );
}
