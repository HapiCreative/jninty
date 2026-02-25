import { db } from "../db/schema.ts";

export interface ProcessedPhoto {
  thumbnailBlob: Blob;
  displayBlob: Blob;
  width: number;
  height: number;
}

const THUMBNAIL_MAX_WIDTH = 320;
const THUMBNAIL_QUALITY = 0.7;
const DISPLAY_MAX_WIDTH = 1600;
const DISPLAY_QUALITY = 0.85;

/**
 * Load a File/Blob as an HTMLImageElement.
 */
function loadImage(source: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(source);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/**
 * Resize an image to fit within maxWidth and export as JPEG blob.
 * Images narrower than maxWidth are not upscaled.
 */
function resizeToBlob(
  img: HTMLImageElement,
  maxWidth: number,
  quality: number,
): Promise<Blob> {
  const scale = Math.min(1, maxWidth / img.naturalWidth);
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas 2d context");
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create blob from canvas"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Process a photo file into thumbnail (320px) and display (1600px) variants.
 */
export async function processPhoto(
  file: File | Blob,
): Promise<ProcessedPhoto> {
  const img = await loadImage(file);
  const width = img.naturalWidth;
  const height = img.naturalHeight;

  const [thumbnailBlob, displayBlob] = await Promise.all([
    resizeToBlob(img, THUMBNAIL_MAX_WIDTH, THUMBNAIL_QUALITY),
    resizeToBlob(img, DISPLAY_MAX_WIDTH, DISPLAY_QUALITY),
  ]);

  return { thumbnailBlob, displayBlob, width, height };
}

/**
 * Open the device camera via a hidden file input with capture="environment".
 * Returns the captured file. Rejects if the user cancels.
 */
export function captureFromCamera(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error("No photo captured"));
      }
    });

    // Handle cancel — the input fires no change event on cancel,
    // but a focus event returns to the window after the dialog closes.
    const onFocus = () => {
      window.removeEventListener("focus", onFocus);
      // Small delay to let the change event fire first if a file was selected.
      setTimeout(() => {
        if (!input.files?.length) {
          reject(new Error("Camera capture cancelled"));
        }
      }, 300);
    };
    window.addEventListener("focus", onFocus);

    input.click();
  });
}

/**
 * Estimate storage usage by summing blob sizes from the photos table.
 * Returns sizes in bytes.
 */
export async function getStorageUsage(): Promise<{
  photos: number;
  data: number;
  total: number;
}> {
  const photos = await db.photos.toArray();
  let photosSize = 0;
  for (const photo of photos) {
    photosSize += photo.thumbnailBlob.size ?? 0;
    if (photo.displayBlob) {
      photosSize += photo.displayBlob.size ?? 0;
    }
  }

  // Use Storage API estimate when available for total usage.
  let total = photosSize;
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    if (estimate.usage != null && estimate.usage > photosSize) {
      total = estimate.usage;
    }
  }

  return {
    photos: photosSize,
    data: Math.max(0, total - photosSize),
    total,
  };
}
