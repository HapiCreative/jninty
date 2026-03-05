import { useState, useMemo, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
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
import { plantRepository, plantingRepository, seasonRepository, taskRepository, scheduleTaskRepository } from "../db/index.ts";
import { getBySpecies } from "../services/knowledgeBase";
import {
  computePlantingWindows,
  type PlantingWindows,
} from "../services/calendar";
import {
  fetchCurrentWeather,
  formatTemp,
  type WeatherData,
} from "../services/weather";
import { useRescheduling } from "../hooks/useRescheduling.ts";
import { useTaskFilter } from "../hooks/useTaskFilter.ts";
import { useToast } from "../components/ui/Toast.tsx";
import TaskFilterToolbar from "../components/calendar/TaskFilterToolbar.tsx";
import { TASK_TYPE_COLORS, TASK_TYPE_LABELS } from "../components/calendar/taskTypeColors.ts";
import Card from "../components/ui/Card";
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon } from "../components/icons";
import Skeleton from "../components/ui/Skeleton";
import type { PlantInstance } from "../validation/plantInstance.schema";
import type { Task } from "../validation/task.schema";
import type { ScheduleTask } from "../validation/scheduleTask.schema.ts";

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

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  const filter = useTaskFilter();
  const { completeWithPropagation } = useRescheduling();
  const { toast } = useToast();

  const activeSeason = usePouchQuery(() => seasonRepository.getActive());
  const allPlantings = usePouchQuery(
    () => (activeSeason ? plantingRepository.getBySeason(activeSeason.id) : Promise.resolve([])),
    [activeSeason],
  );
  const allPlants = usePouchQuery(() => plantRepository.getAll());
  const allTasks = usePouchQuery(() => taskRepository.getAll());
  const allScheduleTasks = usePouchQuery(() => scheduleTaskRepository.getAll());

  // Weather frost warning
  const [weather, setWeather] = useState<WeatherData | null>(null);
  useEffect(() => {
    if (settings.latitude == null || settings.longitude == null) return;
    let cancelled = false;
    void fetchCurrentWeather(settings.latitude, settings.longitude).then(
      (data) => {
        if (!cancelled && data) setWeather(data);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [settings.latitude, settings.longitude]);

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

  // Schedule tasks for the visible month
  const monthScheduleTasks = useMemo(() => {
    if (!allScheduleTasks) return new Map<string, ScheduleTask[]>();
    const map = new Map<string, ScheduleTask[]>();
    const mStart = startOfMonth(currentMonth);
    const mEnd = endOfMonth(currentMonth);

    for (const task of allScheduleTasks) {
      if (!filter.isVisible(task.taskType)) continue;
      const taskDate = parseISO(task.scheduledDate);
      if (isBefore(taskDate, mStart) || isAfter(taskDate, mEnd)) continue;
      const key = task.scheduledDate;
      const existing = map.get(key);
      if (existing) {
        existing.push(task);
      } else {
        map.set(key, [task]);
      }
    }
    return map;
  }, [allScheduleTasks, currentMonth, filter]);

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

  // Schedule tasks for selected day
  const selectedDayScheduleTasks = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, "yyyy-MM-dd");
    return monthScheduleTasks.get(key) ?? [];
  }, [selectedDay, monthScheduleTasks]);

  // Handle schedule task completion
  async function handleCompleteScheduleTask(task: ScheduleTask) {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      if (task.isCompleted) {
        await scheduleTaskRepository.uncomplete(task.id);
      } else {
        const result = await completeWithPropagation(task.id, today);
        if (result) {
          toast(
            `Downstream tasks shifted by +${result.daysDelta} day${result.daysDelta === 1 ? "" : "s"}`,
            "info",
          );
        }
      }
    } catch {
      toast("Failed to update task", "error");
    }
  }

  // Loading
  if (
    settingsLoading ||
    activeSeason === undefined ||
    allPlantings === undefined ||
    allPlants === undefined ||
    allTasks === undefined ||
    allScheduleTasks === undefined
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

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <h1 className="font-display text-2xl font-bold text-text-heading">
        Planting Calendar
      </h1>

      {/* Frost warning */}
      {weather?.frostWarning && (
        <div className="mt-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{"\u2744\uFE0F"}</span>
            <div>
              <p className="text-sm font-bold text-red-800">Frost Warning</p>
              <p className="text-xs text-red-600">
                Tonight&apos;s low is{" "}
                {formatTemp(weather.lowC, settings.temperatureUnit)} — protect
                sensitive plants
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Month navigation */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          className="rounded-lg p-2 text-text-heading transition-colors hover:bg-surface-muted"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <h2 className="font-display text-lg font-semibold text-text-heading">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <button
          onClick={nextMonth}
          aria-label="Next month"
          className="rounded-lg p-2 text-text-heading transition-colors hover:bg-surface-muted"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {WINDOW_TYPES.map((wt) => (
          <span key={wt.key} className="flex items-center gap-1">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${wt.dotClass}`} />
            <span className="text-text-secondary">{wt.label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="text-text-secondary">Frost dates</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rotate-45 bg-brown-600" />
          <span className="text-text-secondary">Tasks</span>
        </span>
      </div>

      {/* Task type filter */}
      <div className="mt-3">
        <TaskFilterToolbar filter={filter} />
      </div>

      {/* Calendar grid */}
      <div className="mt-3 overflow-hidden rounded-xl border border-border-default bg-surface-elevated shadow-sm">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border-default bg-surface">
          {WEEK_DAYS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-text-secondary"
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
            const scheduleTasks = monthScheduleTasks.get(dateKey);
            const hasEvents = events != null && events.length > 0;
            const hasTasks = tasks != null && tasks.length > 0;
            const hasScheduleTasks = scheduleTasks != null && scheduleTasks.length > 0;

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
                className={`relative flex min-h-[3.5rem] flex-col items-center border-b border-r border-border-default p-1 transition-colors ${
                  !isCurrentMonth ? "bg-surface/50 text-text-muted" : "text-text-secondary"
                } ${isSelected ? "bg-green-50 ring-2 ring-inset ring-green-400" : "hover:bg-surface"}`}
              >
                {/* Frost date marker — red line at top */}
                {(isLastFrost || isFirstFrost) && (
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-red-500" />
                )}

                {/* Day number */}
                <span
                  className={`text-sm leading-tight ${
                    isToday
                      ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary font-bold text-white"
                      : ""
                  }`}
                >
                  {format(day, "d")}
                </span>

                {/* Event dots */}
                {(hasEvents || hasTasks || hasScheduleTasks) && (
                  <div className="mt-auto flex flex-wrap justify-center gap-0.5 pb-0.5">
                    {WINDOW_TYPES.map((wt) =>
                      uniqueDots.has(wt.key) ? (
                        <span
                          key={wt.key}
                          className={`h-1.5 w-1.5 rounded-full ${wt.dotClass}`}
                        />
                      ) : null,
                    )}
                    {hasScheduleTasks &&
                      (() => {
                        const stTypes = new Set(scheduleTasks!.map((t) => t.taskType));
                        return [...stTypes].map((tt) => (
                          <span
                            key={`st-${tt}`}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: TASK_TYPE_COLORS[tt] }}
                          />
                        ));
                      })()}
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
            <p className="text-sm text-text-secondary">
              Add plants to a season to see your planting calendar.
            </p>
            <Link
              to="/plants"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-text-on-primary transition-colors hover:bg-primary-hover"
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
          <div className="text-text-secondary">
            <span className="font-medium text-text-primary">Last frost:</span>{" "}
            {format(lastFrostDate, "MMMM d, yyyy")}
            <span className="mx-2 text-text-muted">|</span>
            <span className="font-medium text-text-primary">First frost:</span>{" "}
            {format(firstFrostDate, "MMMM d, yyyy")}
          </div>
        </div>
      </Card>

      {/* Selected day detail panel */}
      {selectedDay &&
        (selectedDayEvents.length > 0 ||
          selectedDayTasks.length > 0 ||
          selectedDayScheduleTasks.length > 0) && (
        <Card className="mt-4">
          <h3 className="font-display text-base font-semibold text-text-heading">
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

          {/* Schedule tasks */}
          {selectedDayScheduleTasks.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                Schedule Tasks
              </p>
              {selectedDayScheduleTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ backgroundColor: `${TASK_TYPE_COLORS[task.taskType]}15` }}
                >
                  <button
                    type="button"
                    onClick={() => handleCompleteScheduleTask(task)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors"
                    style={{
                      borderColor: TASK_TYPE_COLORS[task.taskType],
                      backgroundColor: task.isCompleted
                        ? TASK_TYPE_COLORS[task.taskType]
                        : "transparent",
                    }}
                  >
                    {task.isCompleted && (
                      <CheckIcon className="h-3 w-3 text-white" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`text-sm font-medium ${task.isCompleted ? "line-through text-text-muted" : "text-text-primary"}`}
                    >
                      {task.title}
                    </span>
                    <span className="ml-2 text-xs text-text-muted">
                      {task.cropName}
                    </span>
                  </div>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                    style={{ backgroundColor: TASK_TYPE_COLORS[task.taskType] }}
                  >
                    {TASK_TYPE_LABELS[task.taskType]}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Manual tasks */}
          {selectedDayTasks.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                Tasks
              </p>
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
      {selectedDay &&
        selectedDayEvents.length === 0 &&
        selectedDayTasks.length === 0 &&
        selectedDayScheduleTasks.length === 0 && (
        <Card className="mt-4">
          <p className="text-center text-sm text-text-secondary">
            No planting windows or tasks on {format(selectedDay, "MMMM d")}.
          </p>
        </Card>
      )}

      {/* Plant windows summary */}
      {calendarPlants.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-lg font-semibold text-text-heading">
            Plant Windows
          </h2>
          <div className="mt-2 space-y-2">
            {calendarPlants.map((cp) => (
              <Card key={cp.plantId}>
                <Link
                  to={`/plants/${cp.plantId}`}
                  className="font-medium text-text-heading hover:underline"
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
