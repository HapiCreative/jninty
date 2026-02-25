import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  isBefore,
  isAfter,
} from "date-fns";
import { useSettings } from "../hooks/useSettings";
import * as plantRepository from "../db/repositories/plantRepository";
import * as plantingRepository from "../db/repositories/plantingRepository";
import * as seasonRepository from "../db/repositories/seasonRepository";
import * as taskRepository from "../db/repositories/taskRepository";
import { getBySpecies } from "../services/knowledgeBase";
import {
  computePlantingWindows,
  type PlantingWindows,
} from "../services/calendar";
import Card from "../components/ui/Card";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import Skeleton from "../components/ui/Skeleton";
import type { PlantInstance } from "../validation/plantInstance.schema";
import type { Task } from "../validation/task.schema";

// ─── Window color config ───

interface WindowType {
  key: keyof PlantingWindows;
  label: string;
  bgClass: string;
  dotClass: string;
  textClass: string;
}

const WINDOW_TYPES: WindowType[] = [
  {
    key: "indoorStart",
    label: "Indoor Seed Start",
    bgClass: "bg-blue-100",
    dotClass: "bg-blue-500",
    textClass: "text-blue-700",
  },
  {
    key: "directSow",
    label: "Direct Sow",
    bgClass: "bg-emerald-100",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700",
  },
  {
    key: "transplant",
    label: "Transplant",
    bgClass: "bg-purple-100",
    dotClass: "bg-purple-500",
    textClass: "text-purple-700",
  },
  {
    key: "estimatedHarvest",
    label: "Harvest",
    bgClass: "bg-amber-100",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700",
  },
];

// ─── Types ───

interface CalendarPlant {
  plantId: string;
  plantName: string;
  species: string;
  windows: PlantingWindows;
}

interface DayEvent {
  plantName: string;
  windowType: WindowType;
}

// ─── Component ───

export default function PlantingCalendarPage() {
  const { settings, loading: settingsLoading } = useSettings();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const activeSeason = useLiveQuery(() => seasonRepository.getActive());
  const allPlantings = useLiveQuery(
    () => (activeSeason ? plantingRepository.getBySeason(activeSeason.id) : []),
    [activeSeason],
  );
  const allPlants = useLiveQuery(() => plantRepository.getAll());
  const allTasks = useLiveQuery(() => taskRepository.getAll());

  const prevMonth = useCallback(() => setCurrentMonth((m) => subMonths(m, 1)), []);
  const nextMonth = useCallback(() => setCurrentMonth((m) => addMonths(m, 1)), []);

  // Build a map of plantId → PlantInstance
  const plantMap = useMemo(() => {
    const map = new Map<string, PlantInstance>();
    if (!allPlants) return map;
    for (const p of allPlants) {
      map.set(p.id, p);
    }
    return map;
  }, [allPlants]);

  // Compute planting windows for each plant in the active season's plantings
  const calendarPlants = useMemo<CalendarPlant[]>(() => {
    if (!allPlantings || !allPlants || settingsLoading) return [];

    const results: CalendarPlant[] = [];

    for (const planting of allPlantings) {
      const plant = plantMap.get(planting.plantInstanceId);
      if (!plant) continue;

      const knowledge = getBySpecies(plant.species);
      if (!knowledge) continue;

      const windows = computePlantingWindows(knowledge, settings);
      const hasAnyWindow =
        windows.indoorStart != null ||
        windows.transplant != null ||
        windows.directSow != null ||
        windows.estimatedHarvest != null;

      if (!hasAnyWindow) continue;

      results.push({
        plantId: plant.id,
        plantName: plant.nickname ?? knowledge.commonName,
        species: plant.species,
        windows,
      });
    }

    return results;
  }, [allPlantings, allPlants, plantMap, settings, settingsLoading]);

  // Build the calendar grid days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  // Parse frost dates
  const lastFrostDate = useMemo(() => parseISO(settings.lastFrostDate), [settings.lastFrostDate]);
  const firstFrostDate = useMemo(() => parseISO(settings.firstFrostDate), [settings.firstFrostDate]);

  // Compute events for each day in the grid (for rendering dots/pills)
  const dayEventsMap = useMemo(() => {
    const map = new Map<string, DayEvent[]>();

    for (const day of calendarDays) {
      const dateKey = format(day, "yyyy-MM-dd");
      const events: DayEvent[] = [];

      for (const cp of calendarPlants) {
        for (const wt of WINDOW_TYPES) {
          const window = cp.windows[wt.key];
          if (!window) continue;
          if (isWithinInterval(day, { start: window.start, end: window.end })) {
            events.push({
              plantName: cp.plantName,
              windowType: wt,
            });
          }
        }
      }

      if (events.length > 0) {
        map.set(dateKey, events);
      }
    }

    return map;
  }, [calendarDays, calendarPlants]);

  // Tasks for the visible month
  const monthTasks = useMemo(() => {
    if (!allTasks) return new Map<string, Task[]>();
    const map = new Map<string, Task[]>();
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    for (const task of allTasks) {
      if (task.isCompleted) continue;
      const taskDate = parseISO(task.dueDate);
      if (isBefore(taskDate, monthStart) || isAfter(taskDate, monthEnd)) continue;
      const key = task.dueDate;
      const existing = map.get(key);
      if (existing) {
        existing.push(task);
      } else {
        map.set(key, [task]);
      }
    }
    return map;
  }, [allTasks, currentMonth]);

  // Events for selected day
  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, "yyyy-MM-dd");
    return dayEventsMap.get(key) ?? [];
  }, [selectedDay, dayEventsMap]);

  // Tasks for selected day
  const selectedDayTasks = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, "yyyy-MM-dd");
    return monthTasks.get(key) ?? [];
  }, [selectedDay, monthTasks]);

  // Loading
  if (
    settingsLoading ||
    activeSeason === undefined ||
    allPlantings === undefined ||
    allPlants === undefined ||
    allTasks === undefined
  ) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4" role="status" aria-label="Loading calendar">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const noPlantings = calendarPlants.length === 0;
  const today = new Date();
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <h1 className="font-display text-2xl font-bold text-green-800">
        Planting Calendar
      </h1>

      {/* Month navigation */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          className="rounded-lg p-2 text-green-700 transition-colors hover:bg-cream-200"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <h2 className="font-display text-lg font-semibold text-green-800">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <button
          onClick={nextMonth}
          aria-label="Next month"
          className="rounded-lg p-2 text-green-700 transition-colors hover:bg-cream-200"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {WINDOW_TYPES.map((wt) => (
          <span key={wt.key} className="flex items-center gap-1">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${wt.dotClass}`} />
            <span className="text-soil-600">{wt.label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="text-soil-600">Frost dates</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rotate-45 bg-brown-600" />
          <span className="text-soil-600">Tasks</span>
        </span>
      </div>

      {/* Calendar grid */}
      <div className="mt-3 overflow-hidden rounded-xl border border-cream-200 bg-white shadow-sm">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-cream-200 bg-cream-50">
          {weekDays.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-soil-500"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, today);
            const isSelected = selectedDay != null && isSameDay(day, selectedDay);
            const isLastFrost = isSameDay(day, lastFrostDate);
            const isFirstFrost = isSameDay(day, firstFrostDate);
            const events = dayEventsMap.get(dateKey);
            const tasks = monthTasks.get(dateKey);
            const hasEvents = events != null && events.length > 0;
            const hasTasks = tasks != null && tasks.length > 0;

            // Collect unique window type dots for this day
            const uniqueDots = new Set<string>();
            if (events) {
              for (const e of events) {
                uniqueDots.add(e.windowType.key);
              }
            }

            return (
              <button
                key={dateKey}
                onClick={() => setSelectedDay(day)}
                className={`relative flex min-h-[3.5rem] flex-col items-center border-b border-r border-cream-100 p-1 transition-colors ${
                  !isCurrentMonth ? "bg-cream-50/50 text-soil-300" : "text-soil-700"
                } ${isSelected ? "bg-green-50 ring-2 ring-inset ring-green-400" : "hover:bg-cream-50"}`}
              >
                {/* Frost date marker — red line at top */}
                {(isLastFrost || isFirstFrost) && (
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-red-500" />
                )}

                {/* Day number */}
                <span
                  className={`text-sm leading-tight ${
                    isToday
                      ? "flex h-6 w-6 items-center justify-center rounded-full bg-green-700 font-bold text-white"
                      : ""
                  }`}
                >
                  {format(day, "d")}
                </span>

                {/* Event dots */}
                {(hasEvents || hasTasks) && (
                  <div className="mt-auto flex flex-wrap justify-center gap-0.5 pb-0.5">
                    {WINDOW_TYPES.map((wt) =>
                      uniqueDots.has(wt.key) ? (
                        <span
                          key={wt.key}
                          className={`h-1.5 w-1.5 rounded-full ${wt.dotClass}`}
                        />
                      ) : null,
                    )}
                    {hasTasks && (
                      <span className="h-1.5 w-1.5 rotate-45 bg-brown-600" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {noPlantings && (
        <Card className="mt-4 border-green-200 bg-green-50/50">
          <div className="flex flex-col items-center py-4 text-center">
            <p className="text-sm text-soil-600">
              Add plants to a season to see your planting calendar.
            </p>
            <Link
              to="/plants"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-cream-50 transition-colors hover:bg-green-800"
            >
              View Plants
            </Link>
          </div>
        </Card>
      )}

      {/* Frost date info */}
      <Card className="mt-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
          <div className="text-soil-600">
            <span className="font-medium text-soil-800">Last frost:</span>{" "}
            {format(lastFrostDate, "MMMM d, yyyy")}
            <span className="mx-2 text-soil-300">|</span>
            <span className="font-medium text-soil-800">First frost:</span>{" "}
            {format(firstFrostDate, "MMMM d, yyyy")}
          </div>
        </div>
      </Card>

      {/* Selected day detail panel */}
      {selectedDay && (selectedDayEvents.length > 0 || selectedDayTasks.length > 0) && (
        <Card className="mt-4">
          <h3 className="font-display text-base font-semibold text-green-800">
            {format(selectedDay, "EEEE, MMMM d, yyyy")}
          </h3>

          {/* Planting windows */}
          {selectedDayEvents.length > 0 && (
            <div className="mt-3 space-y-2">
              {selectedDayEvents.map((event, i) => (
                <div
                  key={`${event.plantName}-${event.windowType.key}-${i}`}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 ${event.windowType.bgClass}`}
                >
                  <span className={`h-2 w-2 rounded-full ${event.windowType.dotClass}`} />
                  <span className={`text-sm font-medium ${event.windowType.textClass}`}>
                    {event.plantName}
                  </span>
                  <span className={`ml-auto text-xs ${event.windowType.textClass} opacity-75`}>
                    {event.windowType.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Tasks */}
          {selectedDayTasks.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-soil-500 uppercase tracking-wide">Tasks</p>
              {selectedDayTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 rounded-lg bg-brown-50 px-3 py-2"
                >
                  <span className="h-2 w-2 rotate-45 bg-brown-600" />
                  <span className="text-sm font-medium text-brown-800">
                    {task.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Selected day with no events */}
      {selectedDay && selectedDayEvents.length === 0 && selectedDayTasks.length === 0 && (
        <Card className="mt-4">
          <p className="text-center text-sm text-soil-500">
            No planting windows or tasks on {format(selectedDay, "MMMM d")}.
          </p>
        </Card>
      )}

      {/* Plant windows summary */}
      {calendarPlants.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-lg font-semibold text-green-800">
            Plant Windows
          </h2>
          <div className="mt-2 space-y-2">
            {calendarPlants.map((cp) => (
              <Card key={cp.plantId}>
                <Link
                  to={`/plants/${cp.plantId}`}
                  className="font-medium text-green-700 hover:underline"
                >
                  {cp.plantName}
                </Link>
                <div className="mt-2 flex flex-wrap gap-2">
                  {WINDOW_TYPES.map((wt) => {
                    const window = cp.windows[wt.key];
                    if (!window) return null;
                    return (
                      <span
                        key={wt.key}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${wt.bgClass} ${wt.textClass}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${wt.dotClass}`} />
                        {wt.label}: {format(window.start, "MMM d")} – {format(window.end, "MMM d")}
                      </span>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
