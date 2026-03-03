import { useState, useRef, useCallback, useEffect } from "react";
import Button from "./ui/Button";
import { useFocusTrap } from "../hooks/useFocusTrap";
import type { ImportResult } from "../services/exporter";
import {
  parseZip,
  executeImportMerge,
  executeImportReplace,
  type ParsedImport,
  type ImportWriteResult,
  type ProgressCallback,
} from "../services/importer";

type Step = "select" | "preview" | "confirm" | "importing" | "complete";
type ImportMode = "merge" | "replace";

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

const COUNT_LABELS: Array<{ key: keyof ImportResult["counts"]; label: string }> = [
  { key: "plantInstances", label: "Plants" },
  { key: "journalEntries", label: "Journal Entries" },
  { key: "tasks", label: "Tasks" },
  { key: "gardenBeds", label: "Garden Beds" },
  { key: "seasons", label: "Seasons" },
  { key: "plantings", label: "Plantings" },
  { key: "seeds", label: "Seeds" },
  { key: "taskRules", label: "Task Rules" },
  { key: "userPlantKnowledge", label: "Plant Knowledge" },
  { key: "photos", label: "Photos" },
  { key: "settings", label: "Settings" },
];

export default function ImportDialog({ open, onClose }: ImportDialogProps) {
  const [step, setStep] = useState<Step>("select");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [confirmText, setConfirmText] = useState("");
  const [progressStep, setProgressStep] = useState("");
  const [progressDone, setProgressDone] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [result, setResult] = useState<ImportWriteResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  const handleProgress: ProgressCallback = useCallback(
    (stepName, done, total) => {
      setProgressStep(stepName);
      setProgressDone(done);
      setProgressTotal(total);
    },
    [],
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setParsing(true);
      setParseError(null);
      try {
        const p = await parseZip(file);
        setParsed(p);
        if (!p.valid && p.data === null) {
          setParseError(p.errors.join(", "));
        } else {
          setStep("preview");
        }
      } catch (err) {
        setParseError(
          err instanceof Error ? err.message : "Failed to parse ZIP",
        );
      } finally {
        setParsing(false);
      }
    },
    [],
  );

  const handleImport = useCallback(async () => {
    if (!parsed) return;
    setStep("importing");

    try {
      const writeResult =
        mode === "merge"
          ? await executeImportMerge(parsed, handleProgress)
          : await executeImportReplace(parsed, handleProgress);
      setResult(writeResult);
      setStep("complete");
    } catch (err) {
      setResult({
        inserted: 0,
        skipped: 0,
        errors: [err instanceof Error ? err.message : "Import failed"],
      });
      setStep("complete");
    }
  }, [parsed, mode, handleProgress]);

  const handleClose = useCallback(() => {
    setStep("select");
    setParsed(null);
    setParseError(null);
    setMode("merge");
    setConfirmText("");
    setResult(null);
    setParsing(false);
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step !== "importing") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, step, handleClose]);

  if (!open) return null;

  const totalEntities = parsed
    ? Object.values(parsed.counts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-soil-900/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== "importing") handleClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface-elevated p-6 shadow-xl"
      >
        <h2 id="import-dialog-title" className="font-display text-lg font-bold text-text-heading">
          Import Jninty Backup
        </h2>

        {/* Step 1: File select */}
        {step === "select" && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-text-secondary">
              Select a Jninty backup ZIP file to import. This should be a file
              previously exported from Jninty.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".zip"
              onChange={(e) => void handleFileSelect(e)}
              className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-surface-muted file:px-4 file:py-2 file:text-sm file:font-semibold file:text-text-primary hover:file:bg-surface-muted"
            />
            {parsing && (
              <p className="text-sm text-text-secondary">Reading ZIP file...</p>
            )}
            {parseError && (
              <p className="text-sm text-red-600">{parseError}</p>
            )}
            <div className="flex justify-end">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && parsed && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-border-default bg-surface p-3">
              <h3 className="text-sm font-semibold text-text-primary">
                Backup Contents
              </h3>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {COUNT_LABELS.map(({ key, label }) => {
                    const count = parsed.counts[key];
                    if (count === 0) return null;
                    return (
                      <tr key={key}>
                        <td className="py-0.5 text-text-secondary">{label}</td>
                        <td className="py-0.5 text-right font-medium text-text-primary">
                          {String(count)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-border-default">
                    <td className="pt-1 font-semibold text-text-primary">Total</td>
                    <td className="pt-1 text-right font-bold text-text-primary">
                      {String(totalEntities)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {parsed.errors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <h3 className="text-sm font-semibold text-amber-800">
                  Validation Warnings ({String(parsed.errors.length)})
                </h3>
                <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-amber-700">
                  {parsed.errors.map((err, i) => (
                    <li key={i} className="py-0.5">
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Import mode selector */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Import Mode
              </h3>
              <div className="mt-2 space-y-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-default p-3 has-[:checked]:border-focus-ring has-[:checked]:bg-green-50">
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={mode === "merge"}
                    onChange={() => setMode("merge")}
                    className="mt-0.5 accent-green-700"
                  />
                  <div>
                    <span className="text-sm font-medium text-text-primary">
                      Merge
                    </span>
                    <p className="text-xs text-text-secondary">
                      Keep existing data and add new items from the backup.
                      Duplicates are skipped.
                    </p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-default p-3 has-[:checked]:border-red-600 has-[:checked]:bg-red-50">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={mode === "replace"}
                    onChange={() => setMode("replace")}
                    className="mt-0.5 accent-red-600"
                  />
                  <div>
                    <span className="text-sm font-medium text-text-primary">
                      Replace
                    </span>
                    <p className="text-xs text-text-secondary">
                      Delete all existing data and replace with the backup. This
                      cannot be undone.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (mode === "replace") {
                    setStep("confirm");
                  } else {
                    void handleImport();
                  }
                }}
                disabled={totalEntities === 0}
              >
                {mode === "merge" ? "Import" : "Next"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm (replace only) */}
        {step === "confirm" && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h3 className="text-sm font-bold text-red-800">
                This will delete all existing data
              </h3>
              <p className="mt-1 text-sm text-red-700">
                All plants, journal entries, tasks, photos, and settings will be
                permanently deleted and replaced with the backup data. This
                action cannot be undone.
              </p>
              <p className="mt-3 text-sm font-medium text-red-800">
                Type <strong>DELETE</strong> to confirm:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-red-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="Type DELETE"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setStep("preview")}>
                Back
              </Button>
              <Button
                onClick={() => void handleImport()}
                disabled={confirmText !== "DELETE"}
                className="bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
              >
                Delete & Replace
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === "importing" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm font-medium text-text-primary">{progressStep}</p>
            {progressTotal > 0 && (
              <>
                <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-green-600 transition-all"
                    style={{
                      width: `${String(Math.round((progressDone / progressTotal) * 100))}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-text-secondary">
                  {String(progressDone)} of {String(progressTotal)}
                </p>
              </>
            )}
          </div>
        )}

        {/* Step 5: Complete */}
        {step === "complete" && result && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-green-200 bg-status-success-bg p-4">
              <h3 className="text-sm font-bold text-status-success-text">
                Import Complete
              </h3>
              <div className="mt-2 space-y-1 text-sm text-green-700">
                <p>Inserted: {String(result.inserted)}</p>
                {result.skipped > 0 && (
                  <p>Skipped (duplicates): {String(result.skipped)}</p>
                )}
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <h3 className="text-sm font-semibold text-red-800">
                  Errors ({String(result.errors.length)})
                </h3>
                <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-red-700">
                  {result.errors.map((err, i) => (
                    <li key={i} className="py-0.5">
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
