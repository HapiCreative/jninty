import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { startOfMonth, addMonths, subMonths, differenceInCalendarDays, parseISO, format } from "date-fns";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import TimelineToolbar, { type MonthRange } from "./TimelineToolbar.tsx";
import TimelineRow from "./TimelineRow.tsx";
import { TASK_TYPE_COLORS, TASK_TYPE_LABELS } from "./taskTypeColors.ts";
import HarvestDragModal from "./HarvestDragModal.tsx";
import { useTimelineData } from "../../hooks/useTimelineData.ts";
import { useTaskFilter } from "../../hooks/useTaskFilter.ts";
import { useScheduling } from "../../hooks/useScheduling.ts";
import { useRescheduling } from "../../hooks/useRescheduling.ts";
import { useToast } from "../ui/Toast.tsx";
import { useModalA11y } from "../../hooks/useModalA11y.ts";
import CropPicker, { type CropSelection } from "../scheduling/CropPicker.tsx";
import DirectionPicker from "../scheduling/DirectionPicker.tsx";
import Skeleton from "../ui/Skeleton.tsx";
import type { ScheduleDirection } from "../../validation/plantingSchedule.schema.ts";
import StartingFlowWizard from "../startingFlow/StartingFlowWizard.tsx";
import { useSettings } from "../../hooks/useSettings.tsx";
import { scheduleTaskRepository } from "../../db/index.ts";
import type { ScheduleTask } from "../../validation/scheduleTask.schema.ts";
import type { TimelineBar } from "../../hooks/useTimelineData.ts";

interface PlacementState {
  selection: CropSelection;
}

interface DirectionState {
  selection: CropSelection;
  date: string;
}

interface HarvestDragState {
  task: ScheduleTask;
  targetDate: string;
  daysDelta: number;
}

/** Slide-in panel wrapper with proper modal a11y */
function CropPickerPanel({
  onSelect,
  onClose,
}: {
  onSelect: (selection: CropSelection) => void;
  onClose: () => void;
}) {
  useModalA11y(onClose);

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/30"
        onClick={onClose}
        role="presentation"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Select crop"
        className="h-full w-80 max-w-[85vw] bg-surface-elevated shadow-xl"
      >
        <CropPicker onSelect={onSelect} onClose={onClose} />
      </div>
    </div>
  );
}

export default function TimelineView() {
  const [monthRange, setMonthRange] = useState<MonthRange>(3);
  const [startDate, setStartDate] = useState(() => startOfMonth(new Date()));
  const filter = useTaskFilter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { createSchedule } = useScheduling();
  const { rescheduleGroup, rescheduleSingleTask } = useRescheduling();
  const { toast } = useToast();
  const { settings } = useSettings();

  // Crop picker state
  const [showPicker, setShowPicker] = useState(false);
  const [placement, setPlacement] = useState<PlacementState | null>(null);
  const [directionState, setDirectionState] = useState<DirectionState | null>(
    null,
  );

  // Wizard state
  const [showWizard, setShowWizard] = useState(false);

  // Drag state
  const [activeDrag, setActiveDrag] = useState<{
    task: ScheduleTask;
    bar: TimelineBar;
  } | null>(null);
  const [harvestDrag, setHarvestDrag] = useState<HarvestDragState | null>(null);

  const { monthRows, loading } = useTimelineData(startDate, monthRange);

  // Sensors: PointerSensor with 8px distance, TouchSensor with 250ms delay, KeyboardSensor for a11y
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  const handleToday = useCallback(() => {
    setStartDate(startOfMonth(new Date()));
  }, []);

  const handlePrev = useCallback(() => {
    setStartDate((prev) => subMonths(prev, monthRange));
  }, [monthRange]);

  const handleNext = useCallback(() => {
    setStartDate((prev) => addMonths(prev, monthRange));
  }, [monthRange]);

  // Scroll to today column on mount and when startDate changes
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const todayIndicator = container.querySelector("[data-today]");
    if (todayIndicator) {
      todayIndicator.scrollIntoView({ inline: "center", block: "nearest" });
    }
  }, [monthRows]);

  // --- Drag handlers ---
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as
      | { task: ScheduleTask; bar: TimelineBar }
      | undefined;
    if (data) {
      setActiveDrag({ task: data.task, bar: data.bar });
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDrag(null);

      if (!over) return;

      const dragData = active.data.current as
        | { task: ScheduleTask; bar: TimelineBar }
        | undefined;
      const dropData = over.data.current as { date: string } | undefined;

      if (!dragData || !dropData) return;

      const task = dragData.task;
      const targetDate = dropData.date;
      const daysDelta = differenceInCalendarDays(
        parseISO(targetDate),
        parseISO(task.scheduledDate),
      );

      if (daysDelta === 0) return;

      // If it's a harvest bar, show the harvest-only modal
      if (task.taskType === "harvest") {
        setHarvestDrag({ task, targetDate, daysDelta });
        return;
      }

      // Otherwise, shift the entire schedule
      try {
        const result = await rescheduleGroup(
          task.plantingScheduleId,
          daysDelta,
        );
        toast(
          `${task.cropName} schedule shifted by ${result.daysDelta > 0 ? "+" : ""}${result.daysDelta} day${Math.abs(result.daysDelta) === 1 ? "" : "s"}`,
          "success",
        );
      } catch {
        toast("Failed to reschedule", "error");
      }
    },
    [rescheduleGroup, toast],
  );

  // Harvest drag modal handlers
  const handleHarvestShiftAll = useCallback(async () => {
    if (!harvestDrag) return;
    try {
      const result = await rescheduleGroup(
        harvestDrag.task.plantingScheduleId,
        harvestDrag.daysDelta,
      );
      toast(
        `${harvestDrag.task.cropName} schedule shifted by ${result.daysDelta > 0 ? "+" : ""}${result.daysDelta} day${Math.abs(result.daysDelta) === 1 ? "" : "s"}`,
        "success",
      );
    } catch {
      toast("Failed to reschedule", "error");
    }
    setHarvestDrag(null);
  }, [harvestDrag, rescheduleGroup, toast]);

  const handleHarvestOnly = useCallback(async () => {
    if (!harvestDrag) return;
    try {
      await rescheduleSingleTask(harvestDrag.task.id, harvestDrag.targetDate);
      toast(
        `Harvest date moved to ${harvestDrag.targetDate}`,
        "success",
      );
    } catch {
      toast("Failed to move harvest date", "error");
    }
    setHarvestDrag(null);
  }, [harvestDrag, rescheduleSingleTask, toast]);

  const handleHarvestCancel = useCallback(() => {
    setHarvestDrag(null);
  }, []);

  // --- Task completion toggle ---
  const handleToggleComplete = useCallback(
    async (taskId: string) => {
      try {
        const task = await scheduleTaskRepository.getById(taskId);
        if (!task) return;
        const changes: Parameters<typeof scheduleTaskRepository.update>[1] = task.isCompleted
          ? { isCompleted: false }
          : {
              isCompleted: true,
              completedDate: format(new Date(), "yyyy-MM-dd"),
              completedAt: new Date().toISOString(),
            };
        await scheduleTaskRepository.update(taskId, changes);
        toast(
          task.isCompleted ? "Task marked incomplete" : "Task completed!",
          "success",
        );
      } catch {
        toast("Failed to update task", "error");
      }
    },
    [toast],
  );

  // --- Crop picker handlers ---
  const handleCropSelect = useCallback((selection: CropSelection) => {
    setShowPicker(false);
    setPlacement({ selection });
  }, []);

  const handleDayClick = useCallback(
    (date: string) => {
      if (!placement) return;
      setDirectionState({ selection: placement.selection, date });
    },
    [placement],
  );

  const handleDirectionConfirm = useCallback(
    async (direction: ScheduleDirection) => {
      if (!directionState) return;
      const { selection, date } = directionState;

      try {
        await createSchedule({
          cropId: selection.cropId,
          varietyId: selection.varietyId,
          cropSource: selection.cropSource,
          cropName: selection.cropName,
          varietyName: selection.varietyName,
          anchorDate: date,
          direction,
        });

        toast(
          `${selection.cropName} (${selection.varietyName}) scheduled!`,
          "success",
        );
      } catch (err) {
        toast(
          `Failed to create schedule: ${err instanceof Error ? err.message : "Unknown error"}`,
          "error",
        );
      }

      setDirectionState(null);
      setPlacement(null);
    },
    [directionState, createSchedule, toast],
  );

  const handleDirectionCancel = useCallback(() => {
    setDirectionState(null);
  }, []);

  const handlePickerClose = useCallback(() => {
    setShowPicker(false);
  }, []);

  const cancelPlacement = useCallback(() => {
    setPlacement(null);
  }, []);

  // Empty state content
  const emptyContent = useMemo(() => {
    if (loading) return null;
    const totalBars = monthRows.reduce((sum, row) => sum + row.bars.length, 0);
    if (totalBars === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-text-secondary">
            No scheduled tasks in this period.
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Click &ldquo;Add Crop&rdquo; to create your first planting schedule.
          </p>
        </div>
      );
    }
    return null;
  }, [loading, monthRows]);

  return (
    <div className="relative flex flex-col">
      <TimelineToolbar
        monthRange={monthRange}
        onMonthRangeChange={setMonthRange}
        onToday={handleToday}
        onPrev={handlePrev}
        onNext={handleNext}
        filter={filter}
      />

      {/* Placement mode banner */}
      {placement && (
        <div className="flex items-center justify-between bg-green-50 px-3 py-2 text-sm">
          <span className="text-green-800">
            Click a day to place{" "}
            <strong>
              {placement.selection.cropName} — {placement.selection.varietyName}
            </strong>
          </span>
          <button
            type="button"
            onClick={cancelPlacement}
            className="rounded px-2 py-0.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Add crop buttons */}
      {!placement && (
        <div className="flex justify-end gap-2 px-3 py-1">
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-green-50"
          >
            Wizard
          </button>
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-text-on-primary transition-colors hover:bg-primary-hover"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Quick Add
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : emptyContent ? (
        emptyContent
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            ref={scrollRef}
            className="mx-3 mb-3 overflow-x-auto overflow-y-hidden rounded-xl border border-border-default bg-surface-elevated shadow-sm"
          >
            {monthRows.map((row) => (
              <TimelineRow
                key={row.label}
                row={row}
                filter={filter}
                placementMode={placement !== null}
                onDayClick={handleDayClick}
                lastFrostDate={settings.lastFrostDate}
                firstFrostDate={settings.firstFrostDate}
                onToggleComplete={handleToggleComplete}
              />
            ))}
          </div>

          {/* Drag overlay — ghost bar follows cursor */}
          <DragOverlay dropAnimation={null}>
            {activeDrag ? (
              <div
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white opacity-80 shadow-lg"
                style={{
                  backgroundColor:
                    TASK_TYPE_COLORS[activeDrag.task.taskType],
                  width: `${(activeDrag.bar.endDay - activeDrag.bar.startDay + 1) * 28}px`,
                }}
              >
                <span className="shrink-0 opacity-80">
                  {TASK_TYPE_LABELS[activeDrag.task.taskType]}
                </span>
                <span className="truncate">{activeDrag.task.cropName}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* CropPicker slide-in panel */}
      {showPicker && (
        <CropPickerPanel
          onSelect={handleCropSelect}
          onClose={handlePickerClose}
        />
      )}

      {/* Direction picker modal */}
      {directionState && (
        <DirectionPicker
          date={directionState.date}
          cropName={directionState.selection.cropName}
          varietyName={directionState.selection.varietyName}
          onConfirm={handleDirectionConfirm}
          onCancel={handleDirectionCancel}
        />
      )}

      {/* Harvest drag modal */}
      {harvestDrag && (
        <HarvestDragModal
          cropName={harvestDrag.task.cropName}
          onShiftAll={handleHarvestShiftAll}
          onHarvestOnly={handleHarvestOnly}
          onCancel={handleHarvestCancel}
        />
      )}

      {/* Starting flow wizard */}
      {showWizard && (
        <StartingFlowWizard onClose={() => setShowWizard(false)} />
      )}
    </div>
  );
}
