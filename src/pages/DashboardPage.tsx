import { useMemo } from "react";
import { Link } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import {
  format,
  parseISO,
  formatISO,
  startOfDay,
  formatDistanceToNow,
} from "date-fns";
import { taskRepository, plantRepository, journalRepository, seedRepository } from "../db/index.ts";
import { PRIORITY_VARIANT, PRIORITY_LABELS } from "../constants/taskLabels";
import { ACTIVITY_LABELS } from "../constants/plantLabels";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import PhotoThumbnail from "../components/PhotoThumbnail";
import {
  PlantPlaceholderIcon,
  PlusIcon,
  CameraIcon,
  CheckIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  SeedIcon,
} from "../components/icons";
import Skeleton from "../components/ui/Skeleton";
import SuggestionsList from "../components/SuggestionsList";
import WeatherWidget from "../components/WeatherWidget";
import SpendingWidget from "../components/SpendingWidget";
import { useSettings } from "../hooks/useSettings";
import { formatTemp } from "../services/weather";
import { useToast } from "../components/ui/Toast";
import { useTaskSuggestions } from "../hooks/useTaskSuggestions.ts";

function todayDate(): string {
  return formatISO(startOfDay(new Date()), { representation: "date" });
}

export default function DashboardPage() {
  const { settings } = useSettings();
  const { toast } = useToast();
  const upcomingTasks = usePouchQuery(() => taskRepository.getUpcoming(7));
  const overdueTasks = usePouchQuery(() => taskRepository.getOverdue());
  const allPlants = usePouchQuery(() => plantRepository.getAll());
  const recentEntries = usePouchQuery(() => journalRepository.getRecent(5));
  const expiringSoonSeeds = usePouchQuery(() =>
    seedRepository.getExpiringSoon(30),
  );
  const { suggestions, acceptSuggestion, dismissSuggestion } =
    useTaskSuggestions();

  const plantNames = useMemo(() => {
    const map = new Map<string, string>();
    if (!allPlants) return map;
    for (const p of allPlants) {
      map.set(p.id, p.nickname ?? p.species);
    }
    return map;
  }, [allPlants]);

  const tasks = useMemo(() => {
    if (!upcomingTasks || !overdueTasks) return [];
    const merged = [...overdueTasks, ...upcomingTasks];
    merged.sort((a, b) =>
      a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0,
    );
    return merged;
  }, [upcomingTasks, overdueTasks]);

  const today = todayDate();
  const isFirstTime = allPlants != null && allPlants.length === 0;
  const lastLoggedEntry = recentEntries?.[0];

  async function handleCompleteTask(taskId: string) {
    try {
      await taskRepository.complete(taskId);
    } catch {
      toast("Failed to complete task", "error");
    }
  }

  // Loading state
  if (
    upcomingTasks === undefined ||
    overdueTasks === undefined ||
    allPlants === undefined ||
    recentEntries === undefined ||
    expiringSoonSeeds === undefined
  ) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4" role="status" aria-label="Loading dashboard">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* First-time experience: Welcome card */}
      {isFirstTime && (
        <Card className="mb-4 border-green-300 bg-green-50/50">
          <div className="flex flex-col items-center py-2 text-center">
            <PlantPlaceholderIcon className="h-12 w-12 text-green-600" />
            <h2 className="mt-2 font-display text-lg font-bold text-green-800">
              Welcome to Jninty!
            </h2>
            <p className="mt-1 text-sm text-soil-600">
              Start by adding your first plant.
            </p>
            <Link
              to="/plants/new"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-cream-50 transition-colors hover:bg-green-800"
            >
              <PlusIcon className="h-4 w-4" />
              Add Plant
            </Link>
          </div>
        </Card>
      )}

      {/* First-time: Growing zone nudge (shown when no plants yet) */}
      {isFirstTime && (
        <Card className="mb-4 border-brown-200 bg-brown-50/30">
          <div className="flex items-center gap-3">
            <span className="text-lg">🌱</span>
            <p className="text-sm text-soil-600">
              Set your growing zone in{" "}
              <Link
                to="/settings"
                className="font-medium text-green-700 underline hover:text-green-800"
              >
                Settings
              </Link>{" "}
              for personalized planting dates.
            </p>
          </div>
        </Card>
      )}

      {/* "Today in your garden" prompt card */}
      <Link to="/quick-log" className="block">
        <Card className="border-green-200 bg-green-50/50 transition-shadow hover:shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100">
              <PlantPlaceholderIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-bold text-green-800">
                What&apos;s happening in your garden today?
              </h2>
              {lastLoggedEntry && (
                <p className="mt-0.5 text-xs text-soil-500">
                  Last logged:{" "}
                  {formatDistanceToNow(parseISO(lastLoggedEntry.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              )}
            </div>
            <ChevronRightIcon className="h-5 w-5 shrink-0 text-green-400" />
          </div>
        </Card>
      </Link>

      {/* Weather */}
      <section className="mt-4">
        <WeatherWidget />
      </section>

      {/* Spending */}
      <section className="mt-4">
        <SpendingWidget />
      </section>

      {/* Suggested Tasks */}
      {suggestions && suggestions.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-lg font-semibold text-green-800">
            Suggested Tasks
          </h2>
          <div className="mt-2">
            <SuggestionsList
              suggestions={suggestions}
              plantNames={plantNames}
              onAccept={acceptSuggestion}
              onDismiss={dismissSuggestion}
            />
          </div>
        </section>
      )}

      {/* Seeds Expiring Soon */}
      {expiringSoonSeeds && expiringSoonSeeds.length > 0 && (
        <section className="mt-6">
          <Link to="/seeds" className="block">
            <Card className="border-brown-200 bg-brown-50/30 transition-shadow hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brown-100">
                  <SeedIcon className="h-5 w-5 text-brown-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-soil-900">
                    {expiringSoonSeeds.length}{" "}
                    {expiringSoonSeeds.length === 1 ? "seed" : "seeds"} expiring
                    soon
                  </p>
                  <p className="mt-0.5 text-xs text-soil-500">
                    Check your seed bank before they expire
                  </p>
                </div>
                <ChevronRightIcon className="h-5 w-5 shrink-0 text-brown-400" />
              </div>
            </Card>
          </Link>
        </section>
      )}

      {/* This Week's Tasks */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-green-800">
            This Week&apos;s Tasks
          </h2>
          <Link
            to="/tasks"
            className="text-sm font-medium text-green-700 hover:underline"
          >
            See all tasks &rarr;
          </Link>
        </div>

        {tasks.length === 0 ? (
          <Card className="mt-2">
            <p className="text-center text-sm text-soil-500">
              No tasks this week 🌿
            </p>
          </Card>
        ) : (
          <div className="mt-2 space-y-2">
            {tasks.map((task) => {
              const isOverdue = task.dueDate < today;
              return (
                <Card
                  key={task.id}
                  className={
                    isOverdue
                      ? "border-terracotta-400/50 bg-terracotta-400/5"
                      : ""
                  }
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => void handleCompleteTask(task.id)}
                      className="flex h-11 w-11 -m-3 shrink-0 items-center justify-center"
                      aria-label={`Complete task: ${task.title}`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded border-2 border-green-600 text-transparent transition-colors hover:bg-green-50 hover:text-green-600">
                        <CheckIcon className="h-3 w-3" />
                      </span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-soil-900">
                          {task.title}
                        </span>
                        <Badge variant={PRIORITY_VARIANT[task.priority]}>
                          {PRIORITY_LABELS[task.priority]}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span
                          className={`text-xs ${
                            isOverdue
                              ? "font-medium text-terracotta-600"
                              : "text-soil-500"
                          }`}
                        >
                          {isOverdue ? "Overdue \u2014 " : ""}
                          {format(parseISO(task.dueDate), "MMM d")}
                        </span>
                        {task.plantInstanceId &&
                          plantNames.get(task.plantInstanceId) && (
                            <span className="truncate text-xs text-soil-400">
                              &middot;{" "}
                              {plantNames.get(task.plantInstanceId)}
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Journal */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-green-800">
            Recent Journal
          </h2>
          <Link
            to="/journal"
            className="text-sm font-medium text-green-700 hover:underline"
          >
            See all entries &rarr;
          </Link>
        </div>

        {!recentEntries || recentEntries.length === 0 ? (
          <Card className="mt-2">
            <p className="text-center text-sm text-soil-500">
              Start logging your garden journey ✨
            </p>
          </Card>
        ) : (
          <div className="mt-2 space-y-2">
            {recentEntries.map((entry) => {
              const firstPhotoId = entry.photoIds[0];
              const plantName = entry.plantInstanceId
                ? plantNames.get(entry.plantInstanceId)
                : undefined;
              return (
                <Card key={entry.id}>
                  <div className="flex items-center gap-3">
                    {firstPhotoId ? (
                      <PhotoThumbnail
                        photoId={firstPhotoId}
                        className="h-12 w-12 shrink-0"
                        alt="Journal photo"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cream-200 text-brown-400">
                        <PlantPlaceholderIcon className="h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge>{ACTIVITY_LABELS[entry.activityType]}</Badge>
                        {entry.weatherSnapshot?.tempC != null && (
                          <span className="text-xs text-soil-400">
                            {formatTemp(entry.weatherSnapshot.tempC, settings.temperatureUnit)}
                          </span>
                        )}
                        {plantName && (
                          <span className="truncate text-sm font-medium text-soil-700">
                            {plantName}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-soil-500">
                        {entry.body}
                      </p>
                      <span className="text-xs text-soil-400">
                        {formatDistanceToNow(parseISO(entry.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section className="mt-6 pb-2">
        <div className="grid grid-cols-3 gap-3">
          <Link
            to="/quick-log"
            className="flex flex-col items-center gap-2 rounded-xl border border-cream-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-terracotta-400/15">
              <CameraIcon className="h-5 w-5 text-terracotta-500" />
            </div>
            <span className="text-center text-xs font-medium text-soil-700">
              Log Entry
            </span>
          </Link>
          <Link
            to="/plants/new"
            className="flex flex-col items-center gap-2 rounded-xl border border-cream-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <PlantPlaceholderIcon className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-center text-xs font-medium text-soil-700">
              Add Plant
            </span>
          </Link>
          <Link
            to="/tasks"
            className="flex flex-col items-center gap-2 rounded-xl border border-cream-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brown-100">
              <ClipboardCheckIcon className="h-5 w-5 text-brown-700" />
            </div>
            <span className="text-center text-xs font-medium text-soil-700">
              Add Task
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
