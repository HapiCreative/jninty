import { useState, useEffect, useRef } from "react";
import { localDB } from "../db/pouchdb/client.ts";

/**
 * Reactive query hook for PouchDB.
 * Runs the querier function on mount, when deps change, and
 * when PouchDB emits a change event.
 *
 * Returns undefined while loading, then the resolved value.
 */
export function usePouchQuery<T>(
  querier: () => Promise<T>,
  deps?: unknown[],
): T | undefined {
  const [result, setResult] = useState<T | undefined>(undefined);
  const querierRef = useRef(querier);
  querierRef.current = querier;

  const stableDeps = deps ?? [];

  useEffect(() => {
    let cancelled = false;

    function run() {
      querierRef
        .current()
        .then((data) => {
          if (!cancelled) setResult(data);
        })
        .catch((err: unknown) => {
          console.error("usePouchQuery error:", err);
        });
    }

    // Initial fetch
    run();

    // Subscribe to PouchDB changes for live updates.
    // Filter out _design/ doc changes — PouchDB-Find creates/updates
    // these internally and they cause cascading re-queries.
    const changes = localDB.changes({
      live: true,
      since: "now",
    });

    changes.on("change", (info) => {
      if (info.id.startsWith("_design/")) return;
      run();
    });

    return () => {
      cancelled = true;
      changes.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, stableDeps);

  return result;
}
