import { useLiveQuery } from "dexie-react-hooks";
import * as seasonRepository from "../db/repositories/seasonRepository";

/**
 * Returns the currently active season, or undefined while loading.
 * Uses Dexie live query for reactivity.
 */
export function useActiveSeason() {
  return useLiveQuery(() => seasonRepository.getActive());
}
