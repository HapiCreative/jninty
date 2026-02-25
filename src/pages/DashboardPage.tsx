import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  format,
  parseISO,
  formatISO,
  startOfDay,
  formatDistanceToNow,
} from "date-fns";
import * as taskRepository from "../db/repositories/taskRepository";
import * as plantRepository from "../db/repositories/plantRepository";
import * as journalRepository from "../db/repositories/journalRepository";
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
} from "../components/icons";

function todayDate(): string {
  return formatISO(startOfDay(new Date()), { representation: "date" });
}

export default function DashboardPage() {
  const upcomingTasks = useLiveQuery(() => taskRepository.getUpcoming(7));
  const overdueTasks = useLiveQuery(() => taskRepository.getOverdue());
  const allPlants = useLiveQuery(() => plantRepository.getAll());
  const recentEntries = useLiveQuery(() => journalRepository.getRecent(5));

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
      // Task already completed or deleted; useLiveQuery will reconcile the UI
    }
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
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-green-600 text-transparent transition-colors hover:bg-green-50 hover:text-green-600"
                      aria-label={`Complete task: ${task.title}`}
                    >
                      <CheckIcon className="h-3 w-3" />
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
