import { usePouchQuery } from "./usePouchQuery.ts";
import { seasonRepository } from "../db/index.ts";

/**
 * Returns the currently active season, or undefined while loading.
 * Uses PouchDB live query for reactivity.
 */
export function useActiveSeason() {
  return usePouchQuery(() => seasonRepository.getActive());
}
