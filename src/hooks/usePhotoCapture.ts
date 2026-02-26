import { useState, useCallback } from "react";
import {
  processPhoto,
  processPhotoWithOriginal,
  captureFromCamera,
  selectFile,
  type ProcessedPhoto,
} from "../services/photoProcessor.ts";

export function usePhotoCapture(options?: { keepOriginals?: boolean }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const keepOriginals = options?.keepOriginals ?? false;

  const process = useCallback(
    async (file: File): Promise<ProcessedPhoto> => {
      if (keepOriginals) {
        return await processPhotoWithOriginal(file, { keepOriginal: true });
      }
      return await processPhoto(file);
    },
    [keepOriginals],
  );

  const capturePhoto = useCallback(async (): Promise<ProcessedPhoto> => {
    setIsProcessing(true);
    setError(null);
    try {
      const file = await captureFromCamera();
      return await process(file);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [process]);

  const selectPhoto = useCallback(async (): Promise<ProcessedPhoto> => {
    setIsProcessing(true);
    setError(null);
    try {
      const file = await selectFile();
      return await process(file);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [process]);

  return { capturePhoto, selectPhoto, isProcessing, error };
}
