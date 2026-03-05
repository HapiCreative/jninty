import { useCallback } from "react";
import {
  computeRescheduleUpdates,
  computeDownstreamUpdates,
  computeLateCompletionDelta,
} from "../services/schedulingService.ts";
import {
  scheduleTaskRepository,
  plantingScheduleRepository,
} from "../db/index.ts";
import type { ScheduleTask } from "../validation/scheduleTask.schema.ts";

export interface RescheduleResult {
  daysDelta: number;
  updatedCount: number;
}

export function useRescheduling() {
  /**
   * Reschedule all tasks in a schedule by a day delta.
   * Called after drag-drop on the timeline.
   */
  const rescheduleGroup = useCallback(
    async (
      plantingScheduleId: string,
      daysDelta: number,
    ): Promise<RescheduleResult> => {
      if (daysDelta === 0) return { daysDelta: 0, updatedCount: 0 };

      const tasks =
        await scheduleTaskRepository.getByScheduleId(plantingScheduleId);

      const updates = computeRescheduleUpdates(tasks, daysDelta);
      await scheduleTaskRepository.updateBatch(updates);

      // Update parent schedule cached dates
      const updatedTasks =
        await scheduleTaskRepository.getByScheduleId(plantingScheduleId);
      await updateScheduleCachedDates(plantingScheduleId, updatedTasks);

      return { daysDelta, updatedCount: updates.length };
    },
    [],
  );

  /**
   * Reschedule only a single task (e.g. harvest-only drag).
   */
  const rescheduleSingleTask = useCallback(
    async (taskId: string, newDate: string): Promise<void> => {
      await scheduleTaskRepository.update(taskId, {
        scheduledDate: newDate,
      });
    },
    [],
  );

  /**
   * Handle late task completion — propagate delay to downstream tasks.
   * Returns the delta and count of affected tasks, or null if on-time.
   */
  const completeWithPropagation = useCallback(
    async (
      taskId: string,
      completedDate: string,
    ): Promise<RescheduleResult | null> => {
      const completed = await scheduleTaskRepository.complete(
        taskId,
        completedDate,
      );

      const delta = computeLateCompletionDelta(
        completed.scheduledDate,
        completedDate,
      );

      if (delta <= 0) return null; // On time or early

      const downstream =
        await scheduleTaskRepository.getIncompleteDownstream(
          completed.plantingScheduleId,
          completed.sequenceOrder,
        );

      if (downstream.length === 0) return null;

      const updates = computeDownstreamUpdates(downstream, delta);
      await scheduleTaskRepository.updateBatch(updates);

      // Update parent schedule cached dates
      const allTasks = await scheduleTaskRepository.getByScheduleId(
        completed.plantingScheduleId,
      );
      await updateScheduleCachedDates(
        completed.plantingScheduleId,
        allTasks,
      );

      return { daysDelta: delta, updatedCount: updates.length };
    },
    [],
  );

  return { rescheduleGroup, rescheduleSingleTask, completeWithPropagation };
}

/**
 * Update the parent PlantingSchedule's cached date fields
 * to reflect current task dates.
 */
async function updateScheduleCachedDates(
  scheduleId: string,
  tasks: ScheduleTask[],
): Promise<void> {
  const dateUpdates: Record<string, string> = {};

  for (const task of tasks) {
    switch (task.taskType) {
      case "seed_start":
        dateUpdates["seedStartDate"] = task.scheduledDate;
        break;
      case "bed_prep":
        dateUpdates["bedPrepDate"] = task.scheduledDate;
        break;
      case "transplant":
        dateUpdates["transplantDate"] = task.scheduledDate;
        break;
      case "cultivate":
        dateUpdates["cultivateStartDate"] = task.scheduledDate;
        break;
      case "harvest":
        dateUpdates["harvestStartDate"] = task.scheduledDate;
        break;
    }
  }

  // Only update if we have harvest dates
  if (dateUpdates["harvestStartDate"]) {
    await plantingScheduleRepository.update(scheduleId, dateUpdates);
  }
}
