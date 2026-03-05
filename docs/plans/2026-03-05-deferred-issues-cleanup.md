# Deferred Issues Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 5 deferred issues from the calendar scheduling feature: custom crop search integration, calendar page perf, search type gap, batch atomicity, and missing test coverage.

**Architecture:** Each issue is independent — no ordering dependencies between tasks. I8 (type fix) and I9 (atomicity) are surgical single-file edits. I5 (custom crops in search) requires wiring useCropDB to rebuild the crop search index when custom crops change. I7 (calendar perf) adds a `getByDateRange` to `taskRepository` and swaps `getAll()` calls in the calendar page. I10-I11 adds test files for `computeScheduleDateUpdates` and `scheduleTaskRepository`.

**Tech Stack:** React 18, TypeScript (strict), Vitest, PouchDB (pouchdb-adapter-memory for tests), MiniSearch, date-fns

---

## Task 1: Fix addToIndex to accept ScheduleTask (I8)

**Files:**
- Modify: `src/db/pouchdb/search.ts:191-202`
- Test: `src/db/pouchdb/search.test.ts` (existing)

**Step 1: Write the failing test**

Add to the existing search test file (or create a focused test if no existing test covers `addToIndex`). First check if `search.test.ts` exists. If it does, add to it. If not, add a test in the same file pattern as other repo tests.

```typescript
// In src/db/pouchdb/search.test.ts (or new file)
import { addToIndex, search, _resetIndex } from "./search.ts";
import type { ScheduleTask } from "../../validation/scheduleTask.schema.ts";

describe("addToIndex – scheduleTask", () => {
  beforeEach(() => {
    _resetIndex();
  });

  it("indexes a ScheduleTask and makes it searchable", () => {
    const task: ScheduleTask = {
      id: "st-1",
      plantingScheduleId: "ps-1",
      taskType: "harvest",
      title: "Harvest Cherry Tomato",
      scheduledDate: "2026-06-30",
      originalDate: "2026-06-30",
      sequenceOrder: 4,
      cropName: "Tomato",
      varietyName: "Cherry",
      isCompleted: false,
      version: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    addToIndex(task, "scheduleTask");
    const results = search("Cherry Tomato");
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("st-1");
    expect(results[0]!.entityType).toBe("scheduleTask");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/pouchdb/search.test.ts`
Expected: TypeScript compile error — `ScheduleTask` not assignable to `PlantInstance | JournalEntry | UserPlantKnowledge`

**Step 3: Fix the addToIndex function signature and add the scheduleTask case**

In `src/db/pouchdb/search.ts`, change lines 191-202 from:

```typescript
export function addToIndex(
  entity: PlantInstance | JournalEntry | UserPlantKnowledge,
  type: EntityType,
): void {
  if (type === "userPlantKnowledge") {
    addOrUpdateDocument(userKnowledgeToDocument(entity as UserPlantKnowledge));
  } else if (type === "plant") {
    addOrUpdateDocument(plantToDocument(entity as PlantInstance));
  } else {
    addOrUpdateDocument(journalToDocument(entity as JournalEntry));
  }
}
```

To:

```typescript
export function addToIndex(
  entity: PlantInstance | JournalEntry | UserPlantKnowledge | ScheduleTask,
  type: EntityType,
): void {
  if (type === "scheduleTask") {
    addOrUpdateDocument(scheduleTaskToDocument(entity as ScheduleTask));
  } else if (type === "userPlantKnowledge") {
    addOrUpdateDocument(userKnowledgeToDocument(entity as UserPlantKnowledge));
  } else if (type === "plant") {
    addOrUpdateDocument(plantToDocument(entity as PlantInstance));
  } else {
    addOrUpdateDocument(journalToDocument(entity as JournalEntry));
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/pouchdb/search.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/db/pouchdb/search.ts src/db/pouchdb/search.test.ts
git commit -m "fix: add ScheduleTask to addToIndex type signature (I8)"
```

---

## Task 2: Make updateBatch atomic with bulkDocs (I9)

**Files:**
- Modify: `src/db/pouchdb/repositories/scheduleTaskRepository.ts:281-318`
- Test: `src/db/pouchdb/repositories/scheduleTaskRepository.test.ts` (new, created in Task 6)

This task can be done before or after Task 6 (the test file). The fix is straightforward — gather all docs first, then call `bulkDocs` once.

**Step 1: Write a focused test for updateBatch atomicity**

Create the test inline or in the repo test file from Task 6. If Task 6 hasn't been done yet, create a minimal test file:

```typescript
// src/db/pouchdb/repositories/scheduleTaskRepository.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import PouchDB from "pouchdb";
import PouchDBFind from "pouchdb-find";
import PouchDBAdapterMemory from "pouchdb-adapter-memory";

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(PouchDBAdapterMemory);

let testDB: PouchDB.Database;

vi.mock("../client.ts", () => ({
  get localDB() {
    return testDB;
  },
}));

const repo = await import("./scheduleTaskRepository.ts");

const baseInput = {
  plantingScheduleId: "ps-1",
  taskType: "harvest" as const,
  title: "Harvest Tomato",
  scheduledDate: "2026-06-30",
  originalDate: "2026-06-30",
  sequenceOrder: 4,
  cropName: "Tomato",
  varietyName: "Cherry",
  isCompleted: false,
};

beforeEach(async () => {
  testDB = new PouchDB(`test-schedtask-${crypto.randomUUID()}`, {
    adapter: "memory",
  });
});

describe("updateBatch", () => {
  it("updates multiple tasks atomically via bulkDocs", async () => {
    const t1 = await repo.create({ ...baseInput, title: "Task 1", sequenceOrder: 0, taskType: "seed_start" });
    const t2 = await repo.create({ ...baseInput, title: "Task 2", sequenceOrder: 1, taskType: "transplant" });

    const updated = await repo.updateBatch([
      { id: t1.id, changes: { scheduledDate: "2026-07-01" } },
      { id: t2.id, changes: { scheduledDate: "2026-07-15" } },
    ]);

    expect(updated).toHaveLength(2);
    expect(updated[0]!.scheduledDate).toBe("2026-07-01");
    expect(updated[1]!.scheduledDate).toBe("2026-07-15");

    // Verify persisted
    const fetched1 = await repo.getById(t1.id);
    const fetched2 = await repo.getById(t2.id);
    expect(fetched1!.scheduledDate).toBe("2026-07-01");
    expect(fetched2!.scheduledDate).toBe("2026-07-15");
  });

  it("throws if any task not found", async () => {
    await expect(
      repo.updateBatch([{ id: "nonexistent", changes: { scheduledDate: "2026-07-01" } }]),
    ).rejects.toThrow("ScheduleTask not found");
  });
});
```

**Step 2: Run test to verify it passes with current implementation**

Run: `npx vitest run src/db/pouchdb/repositories/scheduleTaskRepository.test.ts`
Expected: PASS (current implementation works functionally, just not atomically)

**Step 3: Refactor updateBatch to use bulkDocs**

Replace lines 281-318 of `src/db/pouchdb/repositories/scheduleTaskRepository.ts`:

```typescript
export async function updateBatch(
  updates: Array<{ id: string; changes: UpdateInput }>,
): Promise<ScheduleTask[]> {
  const timestamp = now();
  const tasks: ScheduleTask[] = [];
  const docs: PouchDoc<ScheduleTask>[] = [];

  for (const { id, changes } of updates) {
    const docId = `${DOC_TYPE}:${id}`;
    let existing: PouchDoc<ScheduleTask>;
    try {
      existing = await localDB.get<PouchDoc<ScheduleTask>>(docId);
    } catch {
      throw new Error(`ScheduleTask not found: ${id}`);
    }

    const entity = stripPouchFields(existing);
    if (entity.deletedAt != null) {
      throw new Error(`ScheduleTask not found: ${id}`);
    }

    const updated: ScheduleTask = {
      ...entity,
      ...changes,
      id: entity.id,
      version: entity.version + 1,
      createdAt: entity.createdAt,
      updatedAt: timestamp,
    };

    const parsed = scheduleTaskSchema.parse(updated);
    const doc = toPouchDoc(parsed, DOC_TYPE);
    doc._rev = existing._rev;
    docs.push(doc);
    tasks.push(parsed);
  }

  await localDB.bulkDocs(docs);
  return tasks;
}
```

**Step 4: Run test to verify it still passes**

Run: `npx vitest run src/db/pouchdb/repositories/scheduleTaskRepository.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/db/pouchdb/repositories/scheduleTaskRepository.ts src/db/pouchdb/repositories/scheduleTaskRepository.test.ts
git commit -m "fix: make scheduleTaskRepository.updateBatch atomic via bulkDocs (I9)"
```

---

## Task 3: Add taskRepository.getByDateRange for calendar perf (I7)

**Files:**
- Modify: `src/db/pouchdb/repositories/taskRepository.ts`
- Modify: `src/pages/PlantingCalendarPage.tsx:122-123`
- Test: `src/db/pouchdb/repositories/taskRepository.test.ts` (existing)

**Step 1: Write the failing test for getByDateRange**

Add to `src/db/pouchdb/repositories/taskRepository.test.ts`:

```typescript
describe("getByDateRange", () => {
  it("returns only tasks within the date range", async () => {
    await taskRepo.create({ ...baseTask, title: "Before", dueDate: "2026-03-01" });
    await taskRepo.create({ ...baseTask, title: "Inside", dueDate: "2026-03-15" });
    await taskRepo.create({ ...baseTask, title: "After", dueDate: "2026-04-05" });

    const results = await taskRepo.getByDateRange("2026-03-01", "2026-03-31");
    expect(results).toHaveLength(2);
    expect(results.map((t) => t.title).sort()).toEqual(["Before", "Inside"]);
  });

  it("excludes completed and soft-deleted tasks", async () => {
    const task = await taskRepo.create({ ...baseTask, dueDate: "2026-03-15" });
    await taskRepo.complete(task.id);

    const results = await taskRepo.getByDateRange("2026-03-01", "2026-03-31");
    expect(results).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/pouchdb/repositories/taskRepository.test.ts`
Expected: FAIL — `taskRepo.getByDateRange is not a function`

**Step 3: Add getByDateRange to taskRepository**

Add after the `getAll` function in `src/db/pouchdb/repositories/taskRepository.ts` (after line 213):

```typescript
export async function getByDateRange(
  start: string,
  end: string,
): Promise<Task[]> {
  await ensureAllIndexes();
  const result = await localDB.find({
    selector: {
      docType: DOC_TYPE,
      dueDate: { $gte: start, $lte: end },
    },
  });
  return (result.docs as PouchDoc<Task>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null && !r.isCompleted);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/pouchdb/repositories/taskRepository.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/db/pouchdb/repositories/taskRepository.ts src/db/pouchdb/repositories/taskRepository.test.ts
git commit -m "feat: add taskRepository.getByDateRange for calendar perf (I7)"
```

**Step 6: Update PlantingCalendarPage to use date-range queries**

In `src/pages/PlantingCalendarPage.tsx`, change the task fetching (lines 122-123) from:

```typescript
const allTasks = usePouchQuery(() => taskRepository.getAll());
const allScheduleTasks = usePouchQuery(() => scheduleTaskRepository.getAll());
```

To:

```typescript
const monthStart = useMemo(() => format(startOfMonth(currentMonth), "yyyy-MM-dd"), [currentMonth]);
const monthEnd = useMemo(() => format(endOfMonth(currentMonth), "yyyy-MM-dd"), [currentMonth]);

const allTasks = usePouchQuery(
  () => taskRepository.getByDateRange(monthStart, monthEnd),
  [monthStart, monthEnd],
);
const allScheduleTasks = usePouchQuery(
  () => scheduleTaskRepository.getByDateRange(monthStart, monthEnd),
  [monthStart, monthEnd],
);
```

Note: Since `getByDateRange` already filters by `!isCompleted` for tasks and `deletedAt == null` for schedule tasks, also update the `monthTasks` and `monthScheduleTasks` memos (lines 229-270) to remove redundant date range filtering — they only need to bucket into date-keyed maps now.

Update `monthTasks` (lines 229-248):

```typescript
const monthTasks = useMemo(() => {
  if (!allTasks) return new Map<string, Task[]>();
  const map = new Map<string, Task[]>();

  for (const task of allTasks) {
    const key = task.dueDate;
    const existing = map.get(key);
    if (existing) {
      existing.push(task);
    } else {
      map.set(key, [task]);
    }
  }
  return map;
}, [allTasks]);
```

Update `monthScheduleTasks` (lines 251-270):

```typescript
const monthScheduleTasks = useMemo(() => {
  if (!allScheduleTasks) return new Map<string, ScheduleTask[]>();
  const map = new Map<string, ScheduleTask[]>();

  for (const task of allScheduleTasks) {
    if (!filter.isVisible(task.taskType)) continue;
    const key = task.scheduledDate;
    const existing = map.get(key);
    if (existing) {
      existing.push(task);
    } else {
      map.set(key, [task]);
    }
  }
  return map;
}, [allScheduleTasks, filter]);
```

Also remove the unused imports that were only needed for the date filtering: `isBefore`, `isAfter` (verify they're not used elsewhere in the file first).

**Step 7: Export getByDateRange from the db barrel file**

Check if `src/db/index.ts` re-exports the taskRepository — if it does via `* as taskRepository`, no change needed.

**Step 8: Run build to verify type-checking passes**

Run: `npm run build`
Expected: No type errors

**Step 9: Commit**

```bash
git add src/pages/PlantingCalendarPage.tsx src/db/pouchdb/repositories/taskRepository.ts
git commit -m "perf: use date-range queries in PlantingCalendarPage (I7)"
```

---

## Task 4: Merge custom crops into search/browse (I5)

**Files:**
- Modify: `src/hooks/useCropDB.ts`
- Modify: `src/App.tsx:62-64` (optional — keep empty init, hook handles rebuild)

The problem: `useCropDB` merges custom crops into `allCrops` for rendering, but `search()` uses the MiniSearch index built at app startup with `buildCropSearchIndex([])` — custom crops are never indexed.

The fix: When custom crops change, rebuild the search index. Also make `getCropsForCategory` include custom crops.

**Step 1: Update useCropDB to rebuild search index when custom crops change**

In `src/hooks/useCropDB.ts`, add a `useEffect` that calls `buildCropSearchIndex` when `customCrops` changes:

```typescript
import { useMemo, useCallback, useEffect } from "react";
import { loadCropDB, getCategories, getCropsByCategory } from "../data/cropdb/index.ts";
import { searchCrops, buildCropSearchIndex, type CropSearchResult } from "../services/cropDBSearch.ts";
import { usePouchQuery } from "./usePouchQuery.ts";
import { customCropRepository } from "../db/index.ts";
import type { CropRecord } from "../data/cropdb/cropdb.types.ts";

export function useCropDB() {
  const customCrops = usePouchQuery(() => customCropRepository.getAll());

  const allCrops = useMemo((): CropRecord[] => {
    const builtIn = loadCropDB();
    if (!customCrops || customCrops.length === 0) return builtIn;

    const custom: CropRecord[] = customCrops.map((c) => ({
      id: c.id,
      category: c.category,
      commonName: c.commonName,
      varieties: c.varieties.map((v) => ({
        ...v,
        notes: v.notes ?? "",
      })),
    }));

    return [...builtIn, ...custom];
  }, [customCrops]);

  // Rebuild crop search index when custom crops change
  useEffect(() => {
    buildCropSearchIndex(customCrops ?? []);
  }, [customCrops]);

  const categories = useMemo(() => getCategories(), []);

  const getCropsForCategory = useCallback(
    (category: string): CropRecord[] =>
      allCrops.filter((c) => c.category === category),
    [allCrops],
  );

  const search = useCallback(
    (query: string): CropSearchResult[] => searchCrops(query),
    [],
  );

  return {
    allCrops,
    customCrops,
    categories,
    getCropsForCategory,
    search,
    loading: customCrops === undefined,
  };
}
```

Key changes:
1. Import `buildCropSearchIndex` (in addition to existing `searchCrops`)
2. Add `useEffect` that rebuilds the index when `customCrops` changes
3. Change `getCropsForCategory` to filter from `allCrops` (which includes custom) instead of calling `getCropsByCategory` (which only has built-in)

**Step 2: Run build to verify types**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/hooks/useCropDB.ts
git commit -m "fix: rebuild crop search index when custom crops change (I5)"
```

---

## Task 5: Add tests for computeScheduleDateUpdates (I10)

**Files:**
- Modify: `src/services/schedulingService.test.ts`

**Step 1: Add test cases for computeScheduleDateUpdates**

Add the following describe block at the end of `src/services/schedulingService.test.ts`:

```typescript
describe("computeScheduleDateUpdates", () => {
  it("maps task types to corresponding ComputedDates fields", () => {
    const tasks = [
      { taskType: "seed_start" as const, scheduledDate: "2026-03-15" },
      { taskType: "bed_prep" as const, scheduledDate: "2026-04-19" },
      { taskType: "transplant" as const, scheduledDate: "2026-04-26" },
      { taskType: "cultivate" as const, scheduledDate: "2026-05-03" },
      { taskType: "harvest" as const, scheduledDate: "2026-06-30" },
    ];

    const result = computeScheduleDateUpdates(tasks, 60);

    expect(result.seedStartDate).toBe("2026-03-15");
    expect(result.bedPrepDate).toBe("2026-04-19");
    expect(result.transplantDate).toBe("2026-04-26");
    expect(result.cultivateStartDate).toBe("2026-05-03");
    expect(result.harvestStartDate).toBe("2026-06-30");
    // harvest end = Jun 30 + 60 = Aug 29
    expect(result.harvestEndDate).toBe("2026-08-29");
  });

  it("computes harvestEndDate from scheduledDate + harvestWindowDays", () => {
    const tasks = [
      { taskType: "harvest" as const, scheduledDate: "2026-07-01" },
    ];

    const result = computeScheduleDateUpdates(tasks, 30);
    expect(result.harvestStartDate).toBe("2026-07-01");
    // Jul 1 + 30 = Jul 31
    expect(result.harvestEndDate).toBe("2026-07-31");
  });

  it("returns only fields for present task types", () => {
    const tasks = [
      { taskType: "cultivate" as const, scheduledDate: "2026-05-03" },
      { taskType: "harvest" as const, scheduledDate: "2026-06-30" },
    ];

    const result = computeScheduleDateUpdates(tasks, 14);
    expect(result.seedStartDate).toBeUndefined();
    expect(result.bedPrepDate).toBeUndefined();
    expect(result.transplantDate).toBeUndefined();
    expect(result.cultivateStartDate).toBe("2026-05-03");
    expect(result.harvestStartDate).toBe("2026-06-30");
  });

  it("handles empty task array", () => {
    const result = computeScheduleDateUpdates([], 30);
    expect(result).toEqual({});
  });
});
```

Add `computeScheduleDateUpdates` to the import at the top of the file:

```typescript
import {
  computeTaskDates,
  buildTaskInputs,
  computeRescheduleUpdates,
  computeLateCompletionDelta,
  computeDownstreamUpdates,
  computeScheduleDateUpdates,
} from "./schedulingService.ts";
```

**Step 2: Run test**

Run: `npx vitest run src/services/schedulingService.test.ts`
Expected: PASS (these are tests for existing working code)

**Step 3: Commit**

```bash
git add src/services/schedulingService.test.ts
git commit -m "test: add coverage for computeScheduleDateUpdates (I10)"
```

---

## Task 6: Add test coverage for scheduleTaskRepository (I11)

**Files:**
- Create: `src/db/pouchdb/repositories/scheduleTaskRepository.test.ts` (may already exist from Task 2)

If the file was already created in Task 2, extend it. Otherwise create it fresh.

**Step 1: Write comprehensive tests**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import PouchDB from "pouchdb";
import PouchDBFind from "pouchdb-find";
import PouchDBAdapterMemory from "pouchdb-adapter-memory";

PouchDB.plugin(PouchDBFind);
PouchDB.plugin(PouchDBAdapterMemory);

let testDB: PouchDB.Database;

vi.mock("../client.ts", () => ({
  get localDB() {
    return testDB;
  },
}));

const repo = await import("./scheduleTaskRepository.ts");

const baseInput = {
  plantingScheduleId: "ps-1",
  taskType: "harvest" as const,
  title: "Harvest Tomato",
  scheduledDate: "2026-06-30",
  originalDate: "2026-06-30",
  sequenceOrder: 4,
  cropName: "Tomato",
  varietyName: "Cherry",
  isCompleted: false,
};

beforeEach(async () => {
  testDB = new PouchDB(`test-schedtask-${crypto.randomUUID()}`, {
    adapter: "memory",
  });
});

describe("scheduleTaskRepository", () => {
  describe("create", () => {
    it("creates a schedule task with auto-generated fields", async () => {
      const task = await repo.create(baseInput);
      expect(task.id).toBeDefined();
      expect(task.version).toBe(1);
      expect(task.title).toBe("Harvest Tomato");
      expect(task.isCompleted).toBe(false);
      expect(task.deletedAt).toBeUndefined();
    });
  });

  describe("createBatch", () => {
    it("creates multiple tasks atomically", async () => {
      const tasks = await repo.createBatch([
        { ...baseInput, title: "Task 1", sequenceOrder: 0, taskType: "seed_start" },
        { ...baseInput, title: "Task 2", sequenceOrder: 1, taskType: "transplant" },
      ]);
      expect(tasks).toHaveLength(2);
      expect(tasks[0]!.title).toBe("Task 1");
      expect(tasks[1]!.title).toBe("Task 2");
    });
  });

  describe("update", () => {
    it("updates a task and increments version", async () => {
      const task = await repo.create(baseInput);
      const updated = await repo.update(task.id, { scheduledDate: "2026-07-15" });
      expect(updated.scheduledDate).toBe("2026-07-15");
      expect(updated.version).toBe(2);
    });

    it("throws for nonexistent task", async () => {
      await expect(repo.update("nonexistent", { title: "x" })).rejects.toThrow("not found");
    });
  });

  describe("complete / uncomplete", () => {
    it("marks a task as completed", async () => {
      const task = await repo.create(baseInput);
      const completed = await repo.complete(task.id, "2026-07-01");
      expect(completed.isCompleted).toBe(true);
      expect(completed.completedDate).toBe("2026-07-01");
      expect(completed.completedAt).toBeDefined();
    });

    it("uncompletes a task", async () => {
      const task = await repo.create(baseInput);
      await repo.complete(task.id, "2026-07-01");
      const uncompleted = await repo.uncomplete(task.id);
      expect(uncompleted.isCompleted).toBe(false);
      expect(uncompleted.completedDate).toBeUndefined();
    });
  });

  describe("softDelete", () => {
    it("soft-deletes a task", async () => {
      const task = await repo.create(baseInput);
      await repo.softDelete(task.id);
      const fetched = await repo.getById(task.id);
      expect(fetched).toBeUndefined();
    });
  });

  describe("getById", () => {
    it("returns a task by id", async () => {
      const task = await repo.create(baseInput);
      const fetched = await repo.getById(task.id);
      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(task.id);
    });

    it("returns undefined for nonexistent id", async () => {
      const fetched = await repo.getById("nonexistent");
      expect(fetched).toBeUndefined();
    });

    it("returns undefined for soft-deleted task", async () => {
      const task = await repo.create(baseInput);
      await repo.softDelete(task.id);
      expect(await repo.getById(task.id)).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("returns all non-deleted tasks", async () => {
      await repo.create({ ...baseInput, title: "A" });
      const toDelete = await repo.create({ ...baseInput, title: "B" });
      await repo.create({ ...baseInput, title: "C" });
      await repo.softDelete(toDelete.id);

      const all = await repo.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe("getByScheduleId", () => {
    it("returns tasks for a specific planting schedule", async () => {
      await repo.create({ ...baseInput, plantingScheduleId: "ps-1" });
      await repo.create({ ...baseInput, plantingScheduleId: "ps-2" });
      await repo.create({ ...baseInput, plantingScheduleId: "ps-1", title: "Another" });

      const results = await repo.getByScheduleId("ps-1");
      expect(results).toHaveLength(2);
    });

    it("returns tasks sorted by sequenceOrder", async () => {
      await repo.create({ ...baseInput, sequenceOrder: 4, taskType: "harvest" });
      await repo.create({ ...baseInput, sequenceOrder: 0, taskType: "seed_start", title: "Seed" });
      await repo.create({ ...baseInput, sequenceOrder: 2, taskType: "transplant", title: "Transplant" });

      const results = await repo.getByScheduleId("ps-1");
      expect(results.map((t) => t.sequenceOrder)).toEqual([0, 2, 4]);
    });
  });

  describe("getByDateRange", () => {
    it("returns tasks within the date range", async () => {
      await repo.create({ ...baseInput, scheduledDate: "2026-06-01", originalDate: "2026-06-01" });
      await repo.create({ ...baseInput, scheduledDate: "2026-06-15", originalDate: "2026-06-15" });
      await repo.create({ ...baseInput, scheduledDate: "2026-07-15", originalDate: "2026-07-15" });

      const results = await repo.getByDateRange("2026-06-01", "2026-06-30");
      expect(results).toHaveLength(2);
    });
  });

  describe("getIncompleteDownstream", () => {
    it("returns incomplete tasks after the given sequence order", async () => {
      await repo.create({ ...baseInput, sequenceOrder: 0, taskType: "seed_start", title: "Seed" });
      await repo.create({ ...baseInput, sequenceOrder: 2, taskType: "transplant", title: "Transplant" });
      await repo.create({ ...baseInput, sequenceOrder: 4, taskType: "harvest", title: "Harvest" });

      const downstream = await repo.getIncompleteDownstream("ps-1", 0);
      expect(downstream).toHaveLength(2);
      expect(downstream.map((t) => t.sequenceOrder)).toEqual([2, 4]);
    });
  });

  describe("softDeleteByScheduleId", () => {
    it("soft-deletes all tasks for a schedule", async () => {
      await repo.create({ ...baseInput, plantingScheduleId: "ps-1" });
      await repo.create({ ...baseInput, plantingScheduleId: "ps-1", title: "Another" });
      await repo.create({ ...baseInput, plantingScheduleId: "ps-2", title: "Other" });

      await repo.softDeleteByScheduleId("ps-1");

      const ps1Tasks = await repo.getByScheduleId("ps-1");
      expect(ps1Tasks).toHaveLength(0);

      const ps2Tasks = await repo.getByScheduleId("ps-2");
      expect(ps2Tasks).toHaveLength(1);
    });
  });

  describe("updateBatch", () => {
    it("updates multiple tasks atomically", async () => {
      const t1 = await repo.create({ ...baseInput, title: "Task 1", sequenceOrder: 0, taskType: "seed_start" });
      const t2 = await repo.create({ ...baseInput, title: "Task 2", sequenceOrder: 1, taskType: "transplant" });

      const updated = await repo.updateBatch([
        { id: t1.id, changes: { scheduledDate: "2026-07-01" } },
        { id: t2.id, changes: { scheduledDate: "2026-07-15" } },
      ]);

      expect(updated).toHaveLength(2);
      expect(updated[0]!.scheduledDate).toBe("2026-07-01");
      expect(updated[1]!.scheduledDate).toBe("2026-07-15");
    });

    it("throws if any task not found", async () => {
      await expect(
        repo.updateBatch([{ id: "nonexistent", changes: { scheduledDate: "2026-07-01" } }]),
      ).rejects.toThrow("not found");
    });
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/db/pouchdb/repositories/scheduleTaskRepository.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/db/pouchdb/repositories/scheduleTaskRepository.test.ts
git commit -m "test: add scheduleTaskRepository test coverage (I11)"
```

---

## Summary

| Task | Issue | Type | Estimated Steps |
|------|-------|------|-----------------|
| 1 | I8 | Type fix | 5 steps |
| 2 | I9 | Atomicity | 5 steps |
| 3 | I7 | Perf | 9 steps |
| 4 | I5 | Feature | 3 steps |
| 5 | I10 | Tests | 3 steps |
| 6 | I11 | Tests | 3 steps |

**Dependencies:** Tasks 2 and 6 both create/modify `scheduleTaskRepository.test.ts` — do Task 2 first, Task 6 extends it. All other tasks are independent and can be done in any order.

**Verification:** After all tasks, run `npm run build && npm run test` to confirm no regressions.
