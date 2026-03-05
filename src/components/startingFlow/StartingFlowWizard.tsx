import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import StepSelectCrop, { type CropChoice } from "./StepSelectCrop.tsx";
import StepSelectVariety from "./StepSelectVariety.tsx";
import StepSetDate from "./StepSetDate.tsx";
import StepPreviewTimeline from "./StepPreviewTimeline.tsx";
import StepSelectBed from "./StepSelectBed.tsx";
import StepConfirm from "./StepConfirm.tsx";
import { useScheduling } from "../../hooks/useScheduling.ts";
import { useToast } from "../ui/Toast.tsx";
import { getVarietyById } from "../../data/cropdb/index.ts";
import {
  computeTaskDates,
  type ComputedDates,
} from "../../services/schedulingService.ts";
import type { CropVariety } from "../../data/cropdb/cropdb.types.ts";
import type { ScheduleDirection, CropSource } from "../../validation/plantingSchedule.schema.ts";

type WizardStep =
  | "crop"
  | "variety"
  | "date"
  | "preview"
  | "bed"
  | "confirm";

const STEP_ORDER: WizardStep[] = [
  "crop",
  "variety",
  "date",
  "preview",
  "bed",
  "confirm",
];

interface WizardState {
  cropId: string;
  cropName: string;
  cropSource: CropSource;
  varietyId: string;
  varietyName: string;
  variety: CropVariety | null;
  direction: ScheduleDirection;
  anchorDate: string;
  dates: ComputedDates | null;
  bedId: string | null;
  bedName: string | null;
}

const initialState: WizardState = {
  cropId: "",
  cropName: "",
  cropSource: "builtin",
  varietyId: "",
  varietyName: "",
  variety: null,
  direction: "forward",
  anchorDate: "",
  dates: null,
  bedId: null,
  bedName: null,
};

interface StartingFlowWizardProps {
  onClose: () => void;
}

export default function StartingFlowWizard({
  onClose,
}: StartingFlowWizardProps) {
  const [step, setStep] = useState<WizardStep>("crop");
  const [state, setState] = useState<WizardState>(initialState);
  const [saving, setSaving] = useState(false);

  const { createSchedule } = useScheduling();
  const { toast } = useToast();
  const navigate = useNavigate();

  const currentStepIndex = STEP_ORDER.indexOf(step);

  // Step handlers
  const handleCropSelect = useCallback((choice: CropChoice) => {
    setState((prev) => ({
      ...prev,
      cropId: choice.cropId,
      cropName: choice.cropName,
      cropSource: choice.cropSource,
    }));
    setStep("variety");
  }, []);

  const handleVarietySelect = useCallback(
    (variety: CropVariety) => {
      setState((prev) => ({
        ...prev,
        varietyId: variety.id,
        varietyName: variety.name,
        variety,
      }));
      setStep("date");
    },
    [],
  );

  const handleDateConfirm = useCallback(
    (date: string, direction: ScheduleDirection) => {
      const variety = getVarietyById(state.cropId, state.varietyId);
      if (!variety) return;

      const dates = computeTaskDates(variety, date, direction);
      setState((prev) => ({
        ...prev,
        anchorDate: date,
        direction,
        dates,
      }));
      setStep("preview");
    },
    [state.cropId, state.varietyId],
  );

  const handleDateChange = useCallback((key: string, date: string) => {
    setState((prev) => {
      if (!prev.dates) return prev;
      return {
        ...prev,
        dates: { ...prev.dates, [key]: date },
      };
    });
  }, []);

  const handlePreviewConfirm = useCallback(() => {
    setStep("bed");
  }, []);

  const handleBedSelect = useCallback(
    (bedId: string | null, bedName: string | null) => {
      setState((prev) => ({ ...prev, bedId, bedName }));
      setStep("confirm");
    },
    [],
  );

  const handleConfirm = useCallback(async () => {
    setSaving(true);
    try {
      await createSchedule({
        cropId: state.cropId,
        varietyId: state.varietyId,
        cropSource: state.cropSource,
        cropName: state.cropName,
        varietyName: state.varietyName,
        anchorDate: state.anchorDate,
        direction: state.direction,
        ...(state.bedId ? { bedId: state.bedId } : {}),
        ...(state.bedName ? { bedName: state.bedName } : {}),
      });

      toast(
        `${state.cropName} (${state.varietyName}) planting created!`,
        "success",
      );
      onClose();
      navigate("/calendar");
    } catch (err) {
      toast(
        `Failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
      );
      setSaving(false);
    }
  }, [state, createSchedule, toast, onClose, navigate]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface-elevated md:rounded-2xl">
        {/* Header with step dots */}
        <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
          <div className="flex gap-1.5">
            {STEP_ORDER.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 w-6 rounded-full ${
                  i <= currentStepIndex ? "bg-primary" : "bg-border-default"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
            aria-label="Close wizard"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Step content */}
        <div className="p-4">
          {step === "crop" && (
            <StepSelectCrop onSelect={handleCropSelect} />
          )}

          {step === "variety" && (
            <StepSelectVariety
              cropId={state.cropId}
              cropName={state.cropName}
              onSelect={handleVarietySelect}
              onBack={() => setStep("crop")}
            />
          )}

          {step === "date" && (
            <StepSetDate
              onConfirm={handleDateConfirm}
              onBack={() => setStep("variety")}
            />
          )}

          {step === "preview" && state.dates && (
            <StepPreviewTimeline
              dates={state.dates}
              cropName={state.cropName}
              varietyName={state.varietyName}
              onDateChange={handleDateChange}
              onConfirm={handlePreviewConfirm}
              onBack={() => setStep("date")}
            />
          )}

          {step === "bed" && (
            <StepSelectBed
              selectedBedId={state.bedId}
              onSelect={handleBedSelect}
              onBack={() => setStep("preview")}
            />
          )}

          {step === "confirm" && state.dates && (
            <StepConfirm
              cropName={state.cropName}
              varietyName={state.varietyName}
              bedName={state.bedName}
              dates={state.dates}
              saving={saving}
              onConfirm={handleConfirm}
              onBack={() => setStep("bed")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
