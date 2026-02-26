import { db } from "../db/schema.ts";

export interface ProcessedPhoto {
  thumbnailBlob: Blob;
  displayBlob: Blob;
  originalFile?: Blob;
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
 *
 * Note: The design doc (§5.4) envisions staggered processing — show
 * thumbnail immediately while generating the display size in the background.
 * Currently both are generated together in a single call. When the journal
 * quick-entry UI is built, consider splitting into two sequential steps.
 */
export async function processPhoto(
  file: File | Blob,
): Promise<ProcessedPhoto> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`File is not an image: ${file.type}`);
  }

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
 * Process a photo, optionally preserving the original file in memory.
 * The original file is kept as a reference for later OPFS storage
 * when `keepOriginal` is true.
 */
export async function processPhotoWithOriginal(
  file: File | Blob,
  options: { keepOriginal: boolean },
): Promise<ProcessedPhoto> {
  const result = await processPhoto(file);
  if (options.keepOriginal) {
    return { ...result, originalFile: file };
  }
  return result;
}

/**
 * Open a hidden file input, wait for the user to pick a file.
 * Uses the `cancel` event (Chrome 113+, Safari 16.4+) for reliable
 * cancellation detection, with no fallback rejection for older browsers
 * (the promise simply never settles — callers should handle this via
 * AbortController or UI-level timeouts if needed).
 */
export function openFileInput(options: {
  capture?: string;
}): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (options.capture) {
      input.capture = options.capture;
    }

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error("No file selected"));
      }
    });

    // The `cancel` event fires when the user dismisses the file picker.
    // Supported in Chrome 113+, Safari 16.4+. On older browsers the
    // promise simply never settles if the user cancels.
    input.addEventListener("cancel", () => {
      reject(new Error("File selection cancelled"));
    });

    input.click();
  });
}

/**
 * Open the device camera via a hidden file input with capture="environment".
 * Returns the captured file. Rejects if the user cancels (on supported browsers).
 */
export function captureFromCamera(): Promise<File> {
  return openFileInput({ capture: "environment" });
}

/**
 * Open a file picker for selecting an image.
 * Returns the selected file. Rejects if the user cancels (on supported browsers).
 */
export function selectFile(): Promise<File> {
  return openFileInput({});
}

// TODO: Add pasteFromClipboard() — design doc §5.4 requires clipboard paste
// input. Implement using navigator.clipboard.read() or a paste event listener.

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
    photosSize += photo.thumbnailBlob.size;
    if (photo.displayBlob) {
      photosSize += photo.displayBlob.size;
    }
    // TODO: Count originalBlob size when Phase 2 adds original storage.
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
