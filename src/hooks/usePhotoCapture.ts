import { useState, useCallback } from "react";
import {
  processPhoto,
  captureFromCamera,
  selectFile,
  type ProcessedPhoto,
} from "../services/photoProcessor.ts";

export function usePhotoCapture() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const capturePhoto = useCallback(async (): Promise<ProcessedPhoto> => {
    setIsProcessing(true);
    setError(null);
    try {
      const file = await captureFromCamera();
      return await processPhoto(file);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const selectPhoto = useCallback(async (): Promise<ProcessedPhoto> => {
    setIsProcessing(true);
    setError(null);
    try {
      const file = await selectFile();
      return await processPhoto(file);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { capturePhoto, selectPhoto, isProcessing, error };
}
