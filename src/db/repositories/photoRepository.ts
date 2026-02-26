import { db } from "../schema.ts";
import {
  photoSchema,
  type Photo,
} from "../../validation/photo.schema.ts";
import {
  isOpfsAvailable,
  readFile,
  writeFile,
  deleteFile,
  displayPath,
  originalPath,
} from "../../services/opfsStorage.ts";

type CreatePhotoInput = Omit<
  Photo,
  "id" | "version" | "createdAt" | "updatedAt" | "deletedAt"
>;

export type CreatePhotoWithFilesInput = {
  thumbnailBlob: Blob;
  displayBlob: Blob;
  originalFile?: Blob;
  width: number;
  height: number;
};

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

/**
 * Create a photo record, storing display and original blobs in OPFS
 * when available, with IndexedDB fallback.
 */
export async function createWithFiles(
  input: CreatePhotoWithFilesInput,
): Promise<Photo> {
  const timestamp = now();
  const id = crypto.randomUUID();
  const useOpfs = isOpfsAvailable();

  // Write display to OPFS if available
  if (useOpfs) {
    await writeFile(displayPath(id), input.displayBlob);
  }

  // Write original to OPFS if provided and OPFS is available
  let originalStored = false;
  if (useOpfs && input.originalFile) {
    await writeFile(originalPath(id), input.originalFile);
    originalStored = true;
  }

  const record: Photo = {
    thumbnailBlob: input.thumbnailBlob,
    // Store display in IndexedDB only when OPFS is unavailable
    ...(useOpfs ? {} : { displayBlob: input.displayBlob }),
    ...(useOpfs ? { displayStoredInOpfs: true } : {}),
    originalStored,
    ...(input.width > 0 ? { width: input.width } : {}),
    ...(input.height > 0 ? { height: input.height } : {}),
    id,
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

export async function getDisplayBlob(
  photoId: string,
): Promise<Blob | undefined> {
  const photo = await db.photos.get(photoId);
  if (!photo) return undefined;

  if (photo.displayStoredInOpfs) {
    const opfsBlob = await readFile(displayPath(photoId));
    if (opfsBlob) return opfsBlob;
  }

  return photo.displayBlob ?? photo.thumbnailBlob;
}

export async function getOriginalBlob(
  photoId: string,
): Promise<Blob | undefined> {
  const photo = await db.photos.get(photoId);
  if (!photo?.originalStored) return undefined;
  return await readFile(originalPath(photoId));
}

export async function removeWithFiles(id: string): Promise<void> {
  const existing = await db.photos.get(id);
  if (!existing) {
    throw new Error(`Photo not found: ${id}`);
  }

  if (existing.displayStoredInOpfs) {
    await deleteFile(displayPath(id));
  }
  if (existing.originalStored) {
    await deleteFile(originalPath(id));
  }

  await db.photos.delete(id);
}
