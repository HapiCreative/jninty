import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO, formatISO, startOfDay } from "date-fns";
import * as taskRepository from "../db/repositories/taskRepository";
import * as plantRepository from "../db/repositories/plantRepository";
import { PRIORITY_VARIANT, PRIORITY_LABELS } from "../constants/taskLabels";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";

function todayDate(): string {
  return formatISO(startOfDay(new Date()), { representation: "date" });
}

export default function DashboardPage() {
  const upcomingTasks = useLiveQuery(() => taskRepository.getUpcoming(7));
  const overdueTasks = useLiveQuery(() => taskRepository.getOverdue());
  const allPlants = useLiveQuery(() => plantRepository.getAll());

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

  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="font-display text-2xl font-bold text-green-800">
        Dashboard
      </h1>

      {/* Welcome card */}
      <Card className="mt-4">
        <p className="text-soil-700">
          Welcome to Jninty — your personal garden journal.
        </p>
      </Card>

      {/* This Week's Tasks */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-green-800">
            This Week&apos;s Tasks
          </h2>
          <Link
            to="/tasks"
            className="text-sm font-medium text-green-700 hover:underline"
          >
            View all
          </Link>
        </div>

        {tasks.length === 0 ? (
          <Card className="mt-2">
            <p className="text-center text-sm text-soil-500">
              No tasks this week.
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
      </div>
    </div>
  );
}
