import { useState, useMemo, useEffect, useRef } from "react";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import { format, parseISO, formatISO, startOfDay } from "date-fns";
import { taskRepository, plantRepository, seasonRepository } from "../db/index.ts";
import type { Task, TaskPriority, PlantInstance } from "../types";
import {
  PRIORITY_LABELS,
  PRIORITY_VARIANT,
} from "../constants/taskLabels";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import {
  PlusIcon,
  CheckIcon,
  CloseIcon,
  ChevronDownIcon,
  ClipboardCheckIcon,
} from "../components/icons";
import Skeleton from "../components/ui/Skeleton";
import SuggestionsList from "../components/SuggestionsList";
import { useToast } from "../components/ui/Toast";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useTaskSuggestions } from "../hooks/useTaskSuggestions.ts";
import { useNotifications } from "../hooks/useNotifications.ts";
import NotificationPrompt from "../components/NotificationPrompt.tsx";

// ─── Constants ───

const selectClass =
  "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/25";

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  normal: 1,
  low: 2,
};

function todayDate(): string {
  return formatISO(startOfDay(new Date()), { representation: "date" });
}

// ─── Task item ───

function TaskItem({
  task,
  isOverdue,
  plantName,
  isExpanded,
  onToggle,
  onComplete,
  onEdit,
  onDelete,
}: {
  task: Task;
  isOverdue: boolean;
  plantName: string | undefined;
  isExpanded: boolean;
  onToggle: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dueDateFormatted = format(parseISO(task.dueDate), "MMM d");

  return (
    <Card
      className={`transition-shadow ${
        isOverdue && !task.isCompleted
          ? "border-terracotta-400/50 bg-terracotta-400/5"
          : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox — 44px touch target wrapping 20px visual checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          aria-label={task.isCompleted ? "Mark incomplete" : "Mark complete"}
          className="flex h-11 w-11 -m-3 shrink-0 items-center justify-center"
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
              task.isCompleted
                ? "border-focus-ring bg-focus-ring"
                : "border-border-strong hover:border-focus-ring"
            }`}
          >
            {task.isCompleted && <CheckIcon className="h-3 w-3 text-white" />}
          </span>
        </button>

        {/* Main content — tappable to expand */}
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium ${
                task.isCompleted
                  ? "text-text-muted line-through"
                  : "text-text-primary"
              }`}
            >
              {task.title}
            </span>
            <Badge variant={PRIORITY_VARIANT[task.priority]}>
              {PRIORITY_LABELS[task.priority]}
            </Badge>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <span
              className={`text-xs ${
                isOverdue && !task.isCompleted
                  ? "font-medium text-terracotta-600"
                  : "text-text-secondary"
              }`}
            >
              {isOverdue && !task.isCompleted ? "Overdue \u2014 " : ""}
              {dueDateFormatted}
            </span>
            {plantName && (
              <span className="truncate text-xs text-text-muted">
                \u00b7 {plantName}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="mt-3 border-t border-border-default pt-3">
          {task.description && (
            <p className="whitespace-pre-wrap text-sm text-text-secondary">
              {task.description}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onClick={onEdit}>
              Edit
            </Button>
            <Button
              variant="ghost"
              onClick={onDelete}
              className="text-terracotta-600"
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Task form modal ───

function TaskFormModal({
  task,
  plants,
  activeSeasonId,
  onClose,
  onCreated,
}: {
  task: Task | null;
  plants: PlantInstance[];
  activeSeasonId: string | undefined;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(
    task?.dueDate ?? formatISO(new Date(), { representation: "date" }),
  );
  const [priority, setPriority] = useState<TaskPriority>(
    task?.priority ?? "normal",
  );
  const [plantId, setPlantId] = useState(task?.plantInstanceId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!dueDate) {
      setError("Due date is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const input = {
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        dueDate,
        priority,
        isCompleted: task?.isCompleted ?? false,
        ...(plantId ? { plantInstanceId: plantId } : {}),
        ...(task?.completedAt ? { completedAt: task.completedAt } : {}),
      };

      if (task) {
        await taskRepository.update(task.id, input);
      } else {
        await taskRepository.create({
          ...input,
          ...(activeSeasonId ? { seasonId: activeSeasonId } : {}),
        });
        onCreated?.();
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={task ? "Edit task" : "New task"}
    >
      <div
        ref={modalRef}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface-elevated md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="font-display text-lg font-semibold text-text-heading">
            {task ? "Edit Task" : "New Task"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
            aria-label="Close"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {error && (
            <div className="rounded-lg bg-terracotta-400/10 p-3">
              <p className="text-sm text-terracotta-600">{error}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label
              htmlFor="task-title"
              className="block text-sm font-medium text-text-secondary"
            >
              Title <span className="text-terracotta-500">*</span>
            </label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Water the tomatoes"
              className="mt-1"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="task-description"
              className="block text-sm font-medium text-text-secondary"
            >
              Description
            </label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional details..."
              className="mt-1 w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-focus-ring focus:outline-none focus:ring-2 focus:ring-focus-ring/25"
            />
          </div>

          {/* Due Date */}
          <div>
            <label
              htmlFor="task-due-date"
              className="block text-sm font-medium text-text-secondary"
            >
              Due Date <span className="text-terracotta-500">*</span>
            </label>
            <Input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Priority */}
          <div>
            <label
              htmlFor="task-priority"
              className="block text-sm font-medium text-text-secondary"
            >
              Priority
            </label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className={`mt-1 ${selectClass}`}
            >
              <option value="urgent">Urgent</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Link to plant */}
          <div>
            <label
              htmlFor="task-plant"
              className="block text-sm font-medium text-text-secondary"
            >
              Link to Plant
            </label>
            <select
              id="task-plant"
              value={plantId}
              onChange={(e) => setPlantId(e.target.value)}
              className={`mt-1 ${selectClass}`}
            >
              <option value="">None</option>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nickname ?? p.species}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : task ? "Save Changes" : "Create Task"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page component ───

export default function TasksPage() {
  const { toast } = useToast();
  const allTasks = usePouchQuery(() => taskRepository.getAll());
  const allPlants = usePouchQuery(() => plantRepository.getAll());
  const allSeasons = usePouchQuery(() => seasonRepository.getAll());
  const activeSeason = usePouchQuery(() => seasonRepository.getActive());
  const { suggestions, acceptSuggestion, dismissSuggestion } =
    useTaskSuggestions();
  const notifications = useNotifications();
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [sortBy, setSortBy] = useState<"dueDate" | "priority">("dueDate");
  const [seasonFilter, setSeasonFilter] = useState<string | null>(null);

  // Resolve effective filter: null = not yet user-chosen, fall back to active season
  const effectiveSeasonFilter =
    seasonFilter !== null ? seasonFilter : (activeSeason?.id ?? "");

  // Build plant name map
  const plantNames = useMemo(() => {
    const map = new Map<string, string>();
    if (!allPlants) return map;
    for (const p of allPlants) {
      map.set(p.id, p.nickname ?? p.species);
    }
    return map;
  }, [allPlants]);

  // Split and sort tasks
  const { pendingTasks, completedTasks } = useMemo(() => {
    if (!allTasks)
      return { pendingTasks: [] as Task[], completedTasks: [] as Task[] };

    // Filter by season when a season is selected
    const filtered = effectiveSeasonFilter
      ? allTasks.filter((t) => t.seasonId === effectiveSeasonFilter)
      : allTasks;

    const pending = filtered.filter((t) => !t.isCompleted);
    const completed = filtered.filter((t) => t.isCompleted);

    const today = todayDate();

    // Sort pending: overdue first, then by chosen sort
    pending.sort((a, b) => {
      const aOverdue = a.dueDate < today;
      const bOverdue = b.dueDate < today;

      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      if (sortBy === "dueDate") {
        if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      } else {
        if (a.priority !== b.priority)
          return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        return a.dueDate < b.dueDate ? -1 : 1;
      }
    });

    // Sort completed: most recently completed first
    completed.sort((a, b) => {
      if (a.completedAt && b.completedAt) {
        return b.completedAt > a.completedAt
          ? 1
          : b.completedAt < a.completedAt
            ? -1
            : 0;
      }
      return 0;
    });

    return { pendingTasks: pending, completedTasks: completed };
  }, [allTasks, sortBy, effectiveSeasonFilter]);

  async function handleToggleComplete(task: Task) {
    try {
      if (task.isCompleted) {
        await taskRepository.uncomplete(task.id);
      } else {
        await taskRepository.complete(task.id);
      }
    } catch {
      toast("Failed to update task", "error");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this task?")) return;
    try {
      await taskRepository.softDelete(id);
      setExpandedTaskId(null);
    } catch {
      toast("Failed to delete task", "error");
    }
  }

  function handleEdit(task: Task) {
    setEditingTask(task);
    setShowForm(true);
    setExpandedTaskId(null);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingTask(null);
  }

  // Loading state
  if (allTasks === undefined) {
    return (
      <div className="mx-auto max-w-2xl p-4" role="status" aria-label="Loading tasks">
        <Skeleton className="h-8 w-24" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const today = todayDate();
  const overdueCount = pendingTasks.filter((t) => t.dueDate < today).length;

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-heading">
          Tasks
        </h1>
        <span className="text-sm text-text-secondary">
          {pendingTasks.length} pending
          {overdueCount > 0 && (
            <span className="ml-1 text-terracotta-600">
              ({overdueCount} overdue)
            </span>
          )}
        </span>
      </div>

      {/* Season filter */}
      {allSeasons && allSeasons.length > 0 && (
        <div className="mt-3">
          <label htmlFor="season-filter" className="sr-only">
            Filter by season
          </label>
          <select
            id="season-filter"
            value={effectiveSeasonFilter}
            onChange={(e) => setSeasonFilter(e.target.value)}
            className={selectClass}
          >
            <option value="">All Seasons</option>
            {allSeasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.year})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Sort control */}
      {pendingTasks.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-text-secondary">Sort by:</span>
          <div className="flex overflow-hidden rounded-lg border border-border-strong">
            {(
              [
                { value: "dueDate" as const, label: "Due Date" },
                { value: "priority" as const, label: "Priority" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSortBy(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  sortBy === opt.value
                    ? "bg-primary text-text-on-primary"
                    : "bg-surface text-text-secondary hover:bg-surface-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Tasks */}
      {suggestions && suggestions.length > 0 && (
        <section className="mt-4">
          <h2 className="font-display text-base font-semibold text-text-heading">
            Suggested ({suggestions.length})
          </h2>
          <div className="mt-2">
            <SuggestionsList
              suggestions={suggestions}
              plantNames={plantNames}
              onAccept={acceptSuggestion}
              onDismiss={dismissSuggestion}
              showBadge
            />
          </div>
        </section>
      )}

      {/* Pending tasks */}
      {pendingTasks.length === 0 && completedTasks.length === 0 ? (
        <div className="mt-12 text-center">
          <ClipboardCheckIcon className="mx-auto h-16 w-16 text-text-muted" />
          <p className="mt-4 text-lg font-medium text-text-secondary">No tasks yet</p>
          <p className="mt-1 text-sm text-text-secondary">
            Add your first task with the + button below.
          </p>
        </div>
      ) : pendingTasks.length === 0 ? (
        <Card className="mt-4">
          <p className="text-center text-sm text-text-secondary">
            All tasks completed!
          </p>
        </Card>
      ) : (
        <div className="mt-4 space-y-2">
          {pendingTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              isOverdue={task.dueDate < today}
              plantName={
                task.plantInstanceId
                  ? plantNames.get(task.plantInstanceId)
                  : undefined
              }
              isExpanded={expandedTaskId === task.id}
              onToggle={() =>
                setExpandedTaskId(
                  expandedTaskId === task.id ? null : task.id,
                )
              }
              onComplete={() => handleToggleComplete(task)}
              onEdit={() => handleEdit(task)}
              onDelete={() => handleDelete(task.id)}
            />
          ))}
        </div>
      )}

      {/* Completed tasks — collapsible */}
      {completedTasks.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex w-full items-center gap-2 text-left"
          >
            <ChevronDownIcon
              className={`h-4 w-4 text-text-secondary transition-transform ${
                showCompleted ? "" : "-rotate-90"
              }`}
            />
            <span className="font-display text-lg font-semibold text-text-heading">
              Completed
            </span>
            <span className="text-sm text-text-secondary">
              ({completedTasks.length})
            </span>
          </button>

          {showCompleted && (
            <div className="mt-2 space-y-2">
              {completedTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  isOverdue={false}
                  plantName={
                    task.plantInstanceId
                      ? plantNames.get(task.plantInstanceId)
                      : undefined
                  }
                  isExpanded={expandedTaskId === task.id}
                  onToggle={() =>
                    setExpandedTaskId(
                      expandedTaskId === task.id ? null : task.id,
                    )
                  }
                  onComplete={() => handleToggleComplete(task)}
                  onEdit={() => handleEdit(task)}
                  onDelete={() => handleDelete(task.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => setShowForm(true)}
        aria-label="Add task"
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-text-on-primary shadow-lg transition-transform hover:bg-primary-hover active:scale-95 md:bottom-6"
      >
        <PlusIcon className="h-7 w-7" />
      </button>

      {/* Task form modal */}
      {showForm && (
        <TaskFormModal
          task={editingTask}
          plants={allPlants ?? []}
          activeSeasonId={activeSeason?.id}
          onClose={handleFormClose}
          onCreated={() => {
            if (
              !notifications.enabled &&
              !notifications.dismissed &&
              notifications.supported
            ) {
              setShowNotifPrompt(true);
            }
          }}
        />
      )}

      {/* Notification prompt */}
      {showNotifPrompt && (
        <NotificationPrompt
          onEnable={() => {
            void notifications.enable();
            setShowNotifPrompt(false);
          }}
          onDismiss={() => {
            notifications.dismissPrompt();
            setShowNotifPrompt(false);
          }}
        />
      )}
    </div>
  );
}
