import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { usePhotoCapture } from "./usePhotoCapture.ts";

const mockProcessedPhoto = {
  thumbnailBlob: new Blob(["thumb"], { type: "image/jpeg" }),
  displayBlob: new Blob(["display"], { type: "image/jpeg" }),
  width: 3000,
  height: 2000,
};

vi.mock("../services/photoProcessor.ts", () => ({
  captureFromCamera: vi.fn(),
  selectFile: vi.fn(),
  processPhoto: vi.fn(),
}));

// Import the mocked module so we can control return values per test.
import {
  captureFromCamera,
  selectFile,
  processPhoto,
} from "../services/photoProcessor.ts";

const mockCapture = vi.mocked(captureFromCamera);
const mockSelect = vi.mocked(selectFile);
const mockProcess = vi.mocked(processPhoto);

afterEach(() => {
  vi.resetAllMocks();
});

describe("usePhotoCapture", () => {
  it("returns initial state", () => {
    const { result } = renderHook(() => usePhotoCapture());

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.capturePhoto).toBe("function");
    expect(typeof result.current.selectPhoto).toBe("function");
  });

  it("capturePhoto calls captureFromCamera then processPhoto", async () => {
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    mockCapture.mockResolvedValue(file);
    mockProcess.mockResolvedValue(mockProcessedPhoto);

    const { result } = renderHook(() => usePhotoCapture());

    let photo;
    await act(async () => {
      photo = await result.current.capturePhoto();
    });

    expect(mockCapture).toHaveBeenCalledOnce();
    expect(mockProcess).toHaveBeenCalledWith(file);
    expect(photo).toEqual(mockProcessedPhoto);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("selectPhoto calls selectFile then processPhoto", async () => {
    const file = new File(["img"], "picked.jpg", { type: "image/jpeg" });
    mockSelect.mockResolvedValue(file);
    mockProcess.mockResolvedValue(mockProcessedPhoto);

    const { result } = renderHook(() => usePhotoCapture());

    let photo;
    await act(async () => {
      photo = await result.current.selectPhoto();
    });

    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockProcess).toHaveBeenCalledWith(file);
    expect(photo).toEqual(mockProcessedPhoto);
    expect(result.current.isProcessing).toBe(false);
  });

  it("sets error state when capturePhoto fails", async () => {
    mockCapture.mockRejectedValue(new Error("Camera cancelled"));

    const { result } = renderHook(() => usePhotoCapture());

    await act(async () => {
      await expect(result.current.capturePhoto()).rejects.toThrow(
        "Camera cancelled",
      );
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error?.message).toBe("Camera cancelled");
  });

  it("sets error state when selectPhoto fails", async () => {
    mockSelect.mockRejectedValue(new Error("Selection cancelled"));

    const { result } = renderHook(() => usePhotoCapture());

    await act(async () => {
      await expect(result.current.selectPhoto()).rejects.toThrow(
        "Selection cancelled",
      );
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error?.message).toBe("Selection cancelled");
  });

  it("clears previous error on new attempt", async () => {
    mockCapture.mockRejectedValueOnce(new Error("First failure"));

    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    mockCapture.mockResolvedValueOnce(file);
    mockProcess.mockResolvedValue(mockProcessedPhoto);

    const { result } = renderHook(() => usePhotoCapture());

    // First call fails
    await act(async () => {
      await expect(result.current.capturePhoto()).rejects.toThrow();
    });
    expect(result.current.error?.message).toBe("First failure");

    // Second call succeeds — error should be cleared
    await act(async () => {
      await result.current.capturePhoto();
    });
    expect(result.current.error).toBeNull();
  });
});
