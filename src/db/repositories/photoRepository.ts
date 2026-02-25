import { db } from "../schema.ts";
import {
  photoSchema,
  type Photo,
} from "../../validation/photo.schema.ts";

type CreatePhotoInput = Omit<
  Photo,
  "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"
>;

function now(): string {
  return new Date().toISOString();
}

export async function create(input: CreatePhotoInput): Promise<Photo> {
  const timestamp = now();
  const record: Photo = {
    ...input,
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const parsed = photoSchema.parse(record);
  await db.photos.add(parsed);
  return parsed;
}

export async function remove(id: string): Promise<void> {
  const existing = await db.photos.get(id);
  if (!existing) {
    throw new Error(`Photo not found: ${id}`);
  }
  await db.photos.delete(id);
}

export async function getById(id: string): Promise<Photo | undefined> {
  return await db.photos.get(id);
}

export async function getByIds(ids: string[]): Promise<Photo[]> {
  const results = await db.photos.bulkGet(ids);
  return results.filter((r): r is Photo => r != null);
}
