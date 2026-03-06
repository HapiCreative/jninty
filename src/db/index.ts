// Barrel export — single import point for the entire app.
// Points to PouchDB repositories, search, and sync.

// ─── Repositories ───
export * as plantRepository from "./pouchdb/repositories/plantRepository.ts";
export * as journalRepository from "./pouchdb/repositories/journalRepository.ts";
export * as photoRepository from "./pouchdb/repositories/photoRepository.ts";
export * as taskRepository from "./pouchdb/repositories/taskRepository.ts";
export * as gardenBedRepository from "./pouchdb/repositories/gardenBedRepository.ts";
export * as settingsRepository from "./pouchdb/repositories/settingsRepository.ts";
export * as seasonRepository from "./pouchdb/repositories/seasonRepository.ts";
export * as plantingRepository from "./pouchdb/repositories/plantingRepository.ts";
export * as seedRepository from "./pouchdb/repositories/seedRepository.ts";
export * as taskRuleRepository from "./pouchdb/repositories/taskRuleRepository.ts";
export * as expenseRepository from "./pouchdb/repositories/expenseRepository.ts";
export * as userPlantKnowledgeRepository from "./pouchdb/repositories/userPlantKnowledgeRepository.ts";
export * as plantingScheduleRepository from "./pouchdb/repositories/plantingScheduleRepository.ts";
export * as scheduleTaskRepository from "./pouchdb/repositories/scheduleTaskRepository.ts";
// ─── Search ───
export * as search from "./pouchdb/search.ts";

// ─── Sync ───
export {
  localDB,
  setupSync,
  stopSync,
  getSyncStatus,
  subscribeSyncStatus,
  getLastSyncedAt,
  testConnection,
  destroyAndRecreate,
} from "./pouchdb/client.ts";
export type { SyncStatus } from "./pouchdb/client.ts";

export { destroyAndRecreateOriginals } from "./pouchdb/originalsStore.ts";
