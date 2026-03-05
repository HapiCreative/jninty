import { useCallback } from "react";
import {
  computeTaskDates,
  buildTaskInputs,
} from "../services/schedulingService.ts";
import { getVarietyById } from "../data/cropdb/index.ts";
import {
  plantingScheduleRepository,
  scheduleTaskRepository,
} from "../db/index.ts";
import type { ScheduleDirection, CropSource } from "../validation/plantingSchedule.schema.ts";
import type { ScheduleTask } from "../validation/scheduleTask.schema.ts";
import type { PlantingSchedule } from "../validation/plantingSchedule.schema.ts";
import type { CropVariety } from "../data/cropdb/cropdb.types.ts";

export interface CreateScheduleParams {
  cropId: string;
  varietyId: string;
  cropSource: CropSource;
  cropName: string;
  varietyName: string;
  anchorDate: string;
  direction: ScheduleDirection;
  bedId?: string;
  bedName?: string;
  seasonId?: string;
}

export interface CreateScheduleResult {
  schedule: PlantingSchedule;
  tasks: ScheduleTask[];
}

export interface SuccessionParams extends CreateScheduleParams {
  intervalDays: number;
  count: number;
}

function lookupVariety(
  cropId: string,
  varietyId: string,
): CropVariety | undefined {
  return getVarietyById(cropId, varietyId);
}

export function useScheduling() {
  const createSchedule = useCallback(
    async (params: CreateScheduleParams): Promise<CreateScheduleResult> => {
      const variety = lookupVariety(params.cropId, params.varietyId);
      if (!variety) {
        throw new Error(
          `Variety not found: ${params.cropId}/${params.varietyId}`,
        );
      }

      const dates = computeTaskDates(
        variety,
        params.anchorDate,
        params.direction,
      );

      // Build schedule input — use Object.assign for optional fields
      // (exactOptionalPropertyTypes forbids assigning undefined to optional fields)
      const scheduleInput = Object.assign(
        {
          cropId: params.cropId,
          varietyId: params.varietyId,
          cropSource: params.cropSource,
          cropName: params.cropName,
          varietyName: params.varietyName,
          anchorDate: params.anchorDate,
          direction: params.direction,
          harvestStartDate: dates.harvestStartDate,
          harvestEndDate: dates.harvestEndDate,
          status: "active" as const,
        },
        params.bedId ? { bedId: params.bedId } : {},
        params.bedName ? { bedName: params.bedName } : {},
        params.seasonId ? { seasonId: params.seasonId } : {},
        dates.seedStartDate ? { seedStartDate: dates.seedStartDate } : {},
        dates.bedPrepDate ? { bedPrepDate: dates.bedPrepDate } : {},
        dates.transplantDate ? { transplantDate: dates.transplantDate } : {},
        dates.cultivateStartDate
          ? { cultivateStartDate: dates.cultivateStartDate }
          : {},
      );

      const schedule =
        await plantingScheduleRepository.create(scheduleInput);

      const taskInputs = buildTaskInputs(
        dates,
        schedule.id,
        params.cropName,
        params.varietyName,
        params.bedId,
        params.bedName,
      );

      const tasks = await scheduleTaskRepository.createBatch(taskInputs);

      return { schedule, tasks };
    },
    [],
  );

  const createSuccession = useCallback(
    async (
      params: SuccessionParams,
    ): Promise<CreateScheduleResult[]> => {
      const { intervalDays, count, ...baseParams } = params;
      const results: CreateScheduleResult[] = [];
      const groupId = crypto.randomUUID();

      for (let i = 0; i < count; i++) {
        const offsetDays = i * intervalDays;
        const anchorDate = new Date(baseParams.anchorDate);
        anchorDate.setDate(anchorDate.getDate() + offsetDays);
        const offsetAnchor = anchorDate.toISOString().slice(0, 10);

        const result = await createSchedule({
          ...baseParams,
          anchorDate: offsetAnchor,
        });

        // Update the schedule with succession metadata
        await plantingScheduleRepository.update(result.schedule.id, {
          successionGroupId: groupId,
          successionIndex: i,
        });

        results.push(result);
      }

      return results;
    },
    [createSchedule],
  );

  const deleteSchedule = useCallback(async (scheduleId: string) => {
    // Delete all tasks first, then the schedule
    await scheduleTaskRepository.softDeleteByScheduleId(scheduleId);
    await plantingScheduleRepository.softDelete(scheduleId);
  }, []);

  return { createSchedule, createSuccession, deleteSchedule };
}
