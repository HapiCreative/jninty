import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import Button from "./ui/Button";
import { useFocusTrap } from "../hooks/useFocusTrap";
import {
  parseCsvFile,
  autoMapColumns,
  importPlantsFromCsv,
  mapCsvRow,
  CSV_FIELD_OPTIONS,
  type CsvImportResult,
} from "../services/importer";
import { plantInstanceSchema } from "../validation/plantInstance.schema";

interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
}

type Step = "select" | "mapping" | "preview" | "importing" | "complete";

const FIELD_LABELS: Record<string, string> = {
  species: "Species (required)",
  type: "Type (required)",
  source: "Source (required)",
  status: "Status (required)",
  nickname: "Nickname",
  variety: "Variety",
  isPerennial: "Is Perennial",
  dateAcquired: "Date Acquired",
  tags: "Tags (comma-separated)",
  careNotes: "Care Notes",
  purchasePrice: "Purchase Price",
  purchaseStore: "Purchase Store",
};

export default function CsvImportDialog({
  open,
  onClose,
}: CsvImportDialogProps) {
  const [step, setStep] = useState<Step>("select");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  // Build a validated plant candidate from a CSV row
  const validateRow = useCallback(
    (row: Record<string, string>) => {
      const mapped = mapCsvRow(row, columnMap);
      const plant = {
        id: crypto.randomUUID(),
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPerennial: false,
        tags: [],
        ...mapped,
      };
      return { mapped, result: plantInstanceSchema.safeParse(plant) };
    },
    [columnMap],
  );

  // Preview validation: apply mapping to first 10 rows
  const previewRows = useMemo(() => {
    return rows.slice(0, 10).map((row, i) => {
      const { mapped, result } = validateRow(row);
      return {
        rowNum: i + 1,
        valid: result.success,
        error: result.success
          ? null
          : result.error.issues.map((iss) => iss.message).join("; "),
        species: (mapped["species"] as string) ?? "",
        type: (mapped["type"] as string) ?? "",
      };
    });
  }, [rows, validateRow]);

  const totalValid = useMemo(() => {
    let count = 0;
    for (const row of rows) {
      const { result } = validateRow(row);
      if (result.success) count++;
    }
    return count;
  }, [rows, validateRow]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setParsing(true);
      setParseError(null);
      try {
        const { headers: h, rows: r } = await parseCsvFile(file);
        if (h.length === 0) {
          setParseError("No columns found in CSV");
          return;
        }
        setHeaders(h);
        setRows(r);
        setColumnMap(autoMapColumns(h));
        setStep("mapping");
      } catch (err) {
        setParseError(
          err instanceof Error ? err.message : "Failed to parse CSV",
        );
      } finally {
        setParsing(false);
      }
    },
    [],
  );

  const handleImport = useCallback(async () => {
    setImporting(true);
    setStep("importing");
    try {
      const res = await importPlantsFromCsv(rows, columnMap);
      setResult(res);
      setStep("complete");
    } catch (err) {
      setResult({
        inserted: 0,
        errors: [
          {
            row: 0,
            message: err instanceof Error ? err.message : "Import failed",
          },
        ],
      });
      setStep("complete");
    } finally {
      setImporting(false);
    }
  }, [rows, columnMap]);

  const handleClose = useCallback(() => {
    setStep("select");
    setHeaders([]);
    setRows([]);
    setColumnMap({});
    setParseError(null);
    setResult(null);
    setParsing(false);
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !importing) handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, importing, handleClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-soil-900/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !importing) handleClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-import-dialog-title"
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface-elevated p-6 shadow-xl"
      >
        <h2 id="csv-import-dialog-title" className="font-display text-lg font-bold text-text-heading">
          Import Plants from CSV
        </h2>

        {/* Step 1: File select */}
        {step === "select" && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-text-secondary">
              Select a CSV or TSV file with plant data. The first row should
              contain column headers.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv"
              onChange={(e) => void handleFileSelect(e)}
              className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-surface-muted file:px-4 file:py-2 file:text-sm file:font-semibold file:text-text-primary hover:file:bg-surface-muted"
            />
            {parsing && (
              <p className="text-sm text-text-secondary">Reading file...</p>
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

        {/* Step 2: Column mapping */}
        {step === "mapping" && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-text-secondary">
              Map CSV columns to plant fields. Species, type, source, and status
              are required.
            </p>
            <div className="rounded-lg border border-border-default">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-surface">
                    <th className="px-3 py-2 text-left font-medium text-text-secondary">
                      CSV Column
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-text-secondary">
                      Map to Field
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-text-secondary">
                      Sample
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((header) => (
                    <tr key={header} className="border-b border-border-default">
                      <td className="px-3 py-2 font-medium text-text-primary">
                        {header}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={columnMap[header] ?? "-- Skip --"}
                          onChange={(e) =>
                            setColumnMap((prev) => ({
                              ...prev,
                              [header]: e.target.value,
                            }))
                          }
                          className="w-full rounded border border-border-default bg-surface-elevated px-2 py-1 text-sm text-text-primary"
                        >
                          <option value="-- Skip --">-- Skip --</option>
                          {CSV_FIELD_OPTIONS.map((field) => (
                            <option key={field} value={field}>
                              {FIELD_LABELS[field] ?? field}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2 text-xs text-text-secondary">
                        {rows[0]?.[header] ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep("preview")}>Preview</Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-border-default bg-surface p-3">
              <p className="text-sm text-text-primary">
                <span className="font-semibold">{String(rows.length)}</span>{" "}
                rows found, <span className="font-semibold text-text-heading">{String(totalValid)}</span>{" "}
                valid,{" "}
                <span className="font-semibold text-red-600">
                  {String(rows.length - totalValid)}
                </span>{" "}
                invalid
              </p>
            </div>

            <div className="rounded-lg border border-border-default">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-surface">
                    <th className="px-3 py-2 text-left font-medium text-text-secondary">
                      Row
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-text-secondary">
                      Species
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-text-secondary">
                      Type
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-text-secondary">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr
                      key={row.rowNum}
                      className={`border-b border-border-default ${row.valid ? "" : "bg-red-50"}`}
                    >
                      <td className="px-3 py-2 text-text-secondary">
                        {String(row.rowNum)}
                      </td>
                      <td className="px-3 py-2 text-text-primary">
                        {row.species || "-"}
                      </td>
                      <td className="px-3 py-2 text-text-primary">
                        {row.type || "-"}
                      </td>
                      <td className="px-3 py-2">
                        {row.valid ? (
                          <span className="text-text-heading">Valid</span>
                        ) : (
                          <span
                            className="text-red-600"
                            title={row.error ?? ""}
                          >
                            Invalid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length > 10 && (
              <p className="text-xs text-text-secondary">
                Showing first 10 of {String(rows.length)} rows
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setStep("mapping")}>
                Back
              </Button>
              <Button
                onClick={() => void handleImport()}
                disabled={totalValid === 0}
              >
                Import {String(totalValid)} Plants
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === "importing" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm font-medium text-text-primary">
              Importing plants...
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full animate-pulse rounded-full bg-green-600" style={{ width: "60%" }} />
            </div>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === "complete" && result && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-green-200 bg-status-success-bg p-4">
              <h3 className="text-sm font-bold text-status-success-text">
                Import Complete
              </h3>
              <p className="mt-1 text-sm text-green-700">
                {String(result.inserted)} plants imported successfully.
              </p>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <h3 className="text-sm font-semibold text-red-800">
                  Row Errors ({String(result.errors.length)})
                </h3>
                <ul className="mt-1 max-h-40 overflow-y-auto text-xs text-red-700">
                  {result.errors.map((err, i) => (
                    <li key={i} className="py-0.5">
                      Row {String(err.row)}: {err.message}
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
