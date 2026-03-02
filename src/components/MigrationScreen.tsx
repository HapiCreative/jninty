import { useState, useEffect, useCallback } from "react";
import {
  migrateAll,
  verifyMigration,
  type MigrationProgress,
  type MigrationResult,
} from "../db/migration/dexieToPouchdb.ts";

type MigrationState =
  | { phase: "migrating"; table: string; current: number; total: number }
  | { phase: "verifying" }
  | { phase: "complete"; result: MigrationResult; verified: boolean }
  | { phase: "error"; message: string };

export default function MigrationScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [state, setState] = useState<MigrationState>({
    phase: "migrating",
    table: "",
    current: 0,
    total: 0,
  });

  const handleProgress = useCallback((progress: MigrationProgress) => {
    setState({
      phase: "migrating",
      table: progress.table,
      current: progress.current,
      total: progress.total,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const result = await migrateAll(handleProgress);

        if (cancelled) return;

        if (!result.migrated) {
          // Already migrated in a previous session
          onComplete();
          return;
        }

        setState({ phase: "verifying" });

        const verified = await verifyMigration();

        if (cancelled) return;

        setState({ phase: "complete", result, verified });
      } catch (err) {
        if (cancelled) return;
        setState({ phase: "error", message: String(err) });
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [handleProgress, onComplete]);

  const tableLabels: Record<string, string> = {
    plantInstances: "Plants",
    journalEntries: "Journal entries",
    photos: "Photos",
    tasks: "Tasks",
    gardenBeds: "Garden beds",
    settings: "Settings",
    seasons: "Seasons",
    plantings: "Plantings",
    seeds: "Seeds",
    taskRules: "Task rules",
    expenses: "Expenses",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-bold text-green-800">
            Upgrading your data
          </h1>
          <p className="mt-2 text-sm text-soil-500">
            Preparing for multi-device sync...
          </p>
        </div>

        {state.phase === "migrating" && (
          <div>
            <div className="mb-2 flex items-center justify-between text-sm text-soil-500">
              <span>
                {state.table
                  ? `Migrating ${tableLabels[state.table] ?? state.table}...`
                  : "Starting migration..."}
              </span>
              {state.total > 0 && (
                <span>
                  {state.current}/{state.total}
                </span>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-cream-200">
              <div
                className="h-full rounded-full bg-green-600 transition-all duration-300"
                style={{
                  width:
                    state.total > 0
                      ? `${Math.round((state.current / state.total) * 100)}%`
                      : "5%",
                }}
              />
            </div>
          </div>
        )}

        {state.phase === "verifying" && (
          <div className="text-center text-sm text-soil-500">
            Verifying data integrity...
          </div>
        )}

        {state.phase === "complete" && (
          <div>
            <div className="mb-4 rounded-lg bg-green-50 p-4 text-center">
              <p className="font-display text-lg font-semibold text-green-800">
                Migration complete!
              </p>
              <p className="mt-1 text-sm text-green-700">
                {state.verified
                  ? "All data verified successfully."
                  : "Migration finished with verification warnings. Your data is safe."}
              </p>
            </div>

            {state.result.errors.length > 0 && (
              <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-semibold">
                  {state.result.errors.length} warning(s):
                </p>
                <ul className="mt-1 list-inside list-disc">
                  {state.result.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {state.result.errors.length > 5 && (
                    <li>
                      ...and {state.result.errors.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            <button
              onClick={onComplete}
              className="w-full rounded-lg bg-green-700 px-4 py-3 font-display font-semibold text-white hover:bg-green-800 transition-colors"
            >
              Continue to Jninty
            </button>
          </div>
        )}

        {state.phase === "error" && (
          <div>
            <div className="mb-4 rounded-lg bg-red-50 p-4">
              <p className="font-semibold text-red-800">Migration failed</p>
              <p className="mt-1 text-sm text-red-700">{state.message}</p>
            </div>
            <button
              onClick={onComplete}
              className="w-full rounded-lg bg-soil-400 px-4 py-3 font-display font-semibold text-white hover:bg-soil-500 transition-colors"
            >
              Continue anyway
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
