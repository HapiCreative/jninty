import { useState, useCallback } from "react";
import {
  processPhoto,
  captureFromCamera,
  type ProcessedPhoto,
} from "../services/photoProcessor.ts";

function selectFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error("No file selected"));
      }
    });

    const onFocus = () => {
      window.removeEventListener("focus", onFocus);
      setTimeout(() => {
        if (!input.files?.length) {
          reject(new Error("File selection cancelled"));
        }
      }, 300);
    };
    window.addEventListener("focus", onFocus);

    input.click();
  });
}

export function usePhotoCapture() {
  const [isProcessing, setIsProcessing] = useState(false);

  const capturePhoto = useCallback(async (): Promise<ProcessedPhoto> => {
    setIsProcessing(true);
    try {
      const file = await captureFromCamera();
      return await processPhoto(file);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const selectPhoto = useCallback(async (): Promise<ProcessedPhoto> => {
    setIsProcessing(true);
    try {
      const file = await selectFile();
      return await processPhoto(file);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { capturePhoto, selectPhoto, isProcessing };
}
