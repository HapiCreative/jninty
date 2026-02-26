import { db } from "../db/schema.ts";
import {
  isOpfsAvailable,
  getDirectorySize,
  DISPLAY_DIR,
  ORIGINALS_DIR,
} from "./opfsStorage.ts";

export type StorageUsage = {
  thumbnailBytes: number;
  displayBytes: number;
  originalBytes: number;
  dataBytes: number;
  totalBytes: number;
  quotaBytes: number;
};

export async function getStorageUsage(): Promise<StorageUsage> {
  // Sum photo blob sizes from IndexedDB (guard against NaN from corrupted blobs)
  let thumbnailBytes = 0;
  let idbDisplayBytes = 0;
  await db.photos.each((photo) => {
    const thumbSize = photo.thumbnailBlob?.size;
    if (typeof thumbSize === "number" && !Number.isNaN(thumbSize)) {
      thumbnailBytes += thumbSize;
    }
    if (photo.displayBlob) {
      const displaySize = photo.displayBlob.size;
      if (typeof displaySize === "number" && !Number.isNaN(displaySize)) {
        idbDisplayBytes += displaySize;
      }
    }
  });

  // Sum OPFS file sizes
  let opfsDisplayBytes = 0;
  let originalBytes = 0;
  if (isOpfsAvailable()) {
    [opfsDisplayBytes, originalBytes] = await Promise.all([
      getDirectorySize(DISPLAY_DIR),
      getDirectorySize(ORIGINALS_DIR),
    ]);
  }

  const displayBytes = idbDisplayBytes + opfsDisplayBytes;

  // Use Storage API estimate when available
  let totalBytes = 0;
  let quotaBytes = 0;
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    totalBytes = estimate.usage ?? 0;
    quotaBytes = estimate.quota ?? 0;
  }

  const photosTotal = thumbnailBytes + displayBytes + originalBytes;
  if (totalBytes < photosTotal) {
    totalBytes = photosTotal;
  }
  const dataBytes = Math.max(0, totalBytes - photosTotal);

  return { thumbnailBytes, displayBytes, originalBytes, dataBytes, totalBytes, quotaBytes };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
