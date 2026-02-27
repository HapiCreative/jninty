import { localDB } from "../client.ts";
import { type PouchDoc, stripPouchFields, toPouchDoc } from "../utils.ts";
import {
  taskRuleSchema,
  type TaskRule,
} from "../../../validation/taskRule.schema.ts";

const DOC_TYPE = "taskRule";

type CreateTaskRuleInput = Omit<
  TaskRule,
  "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"
>;

type UpdateTaskRuleInput = Partial<CreateTaskRuleInput>;

type UpsertBuiltInInput = Omit<
  TaskRule,
  "version" | "createdAt" | "updatedAt" | "deletedAt"
> & { id: string };

function now(): string {
  return new Date().toISOString();
}

export async function create(input: CreateTaskRuleInput): Promise<TaskRule> {
  const timestamp = now();
  const record: TaskRule = {
    ...input,
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const parsed = taskRuleSchema.parse(record);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  await localDB.put(doc);
  return parsed;
}

export async function update(
  id: string,
  changes: UpdateTaskRuleInput,
): Promise<TaskRule> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<TaskRule>;
  try {
    existing = await localDB.get<PouchDoc<TaskRule>>(docId);
  } catch {
    throw new Error(`TaskRule not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`TaskRule not found: ${id}`);
  }

  const updated: TaskRule = {
    ...entity,
    ...changes,
    id: entity.id,
    version: entity.version + 1,
    createdAt: entity.createdAt,
    updatedAt: now(),
  };

  const parsed = taskRuleSchema.parse(updated);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  doc._rev = existing._rev;
  await localDB.put(doc);
  return parsed;
}

export async function softDelete(id: string): Promise<void> {
  const docId = `${DOC_TYPE}:${id}`;
  let existing: PouchDoc<TaskRule>;
  try {
    existing = await localDB.get<PouchDoc<TaskRule>>(docId);
  } catch {
    throw new Error(`TaskRule not found: ${id}`);
  }

  const entity = stripPouchFields(existing);
  if (entity.deletedAt != null) {
    throw new Error(`TaskRule not found: ${id}`);
  }

  const timestamp = now();
  const deleted = taskRuleSchema.parse({
    ...entity,
    deletedAt: timestamp,
    updatedAt: timestamp,
    version: entity.version + 1,
  });

  const doc = toPouchDoc(deleted, DOC_TYPE);
  doc._rev = existing._rev;
  await localDB.put(doc);
}

export async function getById(id: string): Promise<TaskRule | undefined> {
  const docId = `${DOC_TYPE}:${id}`;
  try {
    const doc = await localDB.get<PouchDoc<TaskRule>>(docId);
    const entity = stripPouchFields(doc);
    if (entity.deletedAt != null) return undefined;
    return entity;
  } catch {
    return undefined;
  }
}

export async function getAll(): Promise<TaskRule[]> {
  const result = await localDB.find({
    selector: { docType: DOC_TYPE },
  });
  return (result.docs as PouchDoc<TaskRule>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null);
}

export async function getBuiltIn(): Promise<TaskRule[]> {
  const result = await localDB.find({
    selector: { docType: DOC_TYPE },
  });
  return (result.docs as PouchDoc<TaskRule>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null && r.isBuiltIn);
}

export async function getUserCreated(): Promise<TaskRule[]> {
  const result = await localDB.find({
    selector: { docType: DOC_TYPE },
  });
  return (result.docs as PouchDoc<TaskRule>[])
    .map(stripPouchFields)
    .filter((r) => r.deletedAt == null && !r.isBuiltIn);
}

export async function upsertBuiltIn(
  input: UpsertBuiltInInput,
): Promise<TaskRule> {
  const timestamp = now();
  const docId = `${DOC_TYPE}:${input.id}`;

  let existingDoc: PouchDoc<TaskRule> | undefined;
  let existingEntity: TaskRule | undefined;
  try {
    existingDoc = await localDB.get<PouchDoc<TaskRule>>(docId);
    existingEntity = stripPouchFields(existingDoc);
  } catch {
    // Document doesn't exist — will create
  }

  const record: TaskRule = {
    ...input,
    version: existingEntity ? existingEntity.version + 1 : 1,
    createdAt: existingEntity?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  const parsed = taskRuleSchema.parse(record);
  const doc = toPouchDoc(parsed, DOC_TYPE);
  if (existingDoc?._rev) {
    doc._rev = existingDoc._rev;
  }
  await localDB.put(doc);
  return parsed;
}
