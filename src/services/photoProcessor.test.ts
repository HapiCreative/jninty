import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { clearPouchDB } from "../db/pouchdb/testUtils.ts";
import { processPhoto } from "./photoProcessor.ts";

// ─── Canvas / Image mocks for jsdom ───

function installCanvasMock(outputSize: number) {
  const originalCreateElement = document.createElement.bind(document);

  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "canvas") {
      const canvas = originalCreateElement("canvas");

      canvas.getContext = vi.fn().mockReturnValue({
        drawImage: vi.fn(),
      });

      canvas.toBlob = vi.fn(
        (callback: BlobCallback, type?: string) => {
          const data = new Uint8Array(outputSize).fill(0);
          callback(new Blob([data], { type: type ?? "image/jpeg" }));
        },
      );

      return canvas;
    }
    return originalCreateElement(tag);
  });
}

function installImageMock(width: number, height: number) {
  // jsdom doesn't define URL.createObjectURL — stub them globally.
  globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
  globalThis.URL.revokeObjectURL = vi.fn();

  // Lightweight Image mock — avoids HTMLImageElement prototype issues
  // with non-configurable naturalWidth/naturalHeight in jsdom.
  vi.stubGlobal(
    "Image",
    class MockImage {
      naturalWidth = width;
      naturalHeight = height;
      onload: ((ev: Event) => void) | null = null;
      onerror: ((ev: Event | string) => void) | null = null;
      src = "";

      constructor() {
        setTimeout(() => {
          this.onload?.(new Event("load"));
        }, 0);
      }
    },
  );
}

function installCanvasWithSizeCapture(
  sizes: Array<{ width: number; height: number }>,
) {
  const originalCreateElement = document.createElement.bind(document);

  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "canvas") {
      const canvas = originalCreateElement("canvas");
      let w = 0;
      let h = 0;
      Object.defineProperty(canvas, "width", {
        get: () => w,
        set: (val: number) => {
          w = val;
        },
        configurable: true,
      });
      Object.defineProperty(canvas, "height", {
        get: () => h,
        set: (val: number) => {
          h = val;
          sizes.push({ width: w, height: h });
        },
        configurable: true,
      });

      canvas.getContext = vi.fn().mockReturnValue({ drawImage: vi.fn() });
      canvas.toBlob = vi.fn((cb: BlobCallback) => {
        cb(new Blob([new Uint8Array(100)], { type: "image/jpeg" }));
      });

      return canvas;
    }
    return originalCreateElement(tag);
  });
}

// ─── DB setup ───

beforeEach(async () => {
  await clearPouchDB();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── processPhoto ───

describe("processPhoto", () => {
  it("returns thumbnail and display blobs with original dimensions", async () => {
    installImageMock(3000, 2000);
    installCanvasMock(500);

    const file = new File(["x".repeat(50_000)], "photo.jpg", {
      type: "image/jpeg",
    });

    const result = await processPhoto(file);

    expect(result.thumbnailBlob).toBeInstanceOf(Blob);
    expect(result.displayBlob).toBeInstanceOf(Blob);
    expect(result.width).toBe(3000);
    expect(result.height).toBe(2000);
  });

  it("creates canvas elements with correct scaled dimensions", async () => {
    installImageMock(4000, 3000);

    const canvasSizes: Array<{ width: number; height: number }> = [];
    installCanvasWithSizeCapture(canvasSizes);

    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    await processPhoto(file);

    // Thumbnail: 4000 → 320 (scale 0.08), height 3000 * 0.08 = 240
    const thumb = canvasSizes.find((s) => s.width === 320);
    expect(thumb).toBeDefined();
    expect(thumb!.height).toBe(240);

    // Display: 4000 → 1600 (scale 0.4), height 3000 * 0.4 = 1200
    const display = canvasSizes.find((s) => s.width === 1600);
    expect(display).toBeDefined();
    expect(display!.height).toBe(1200);
  });

  it("rejects non-image files", async () => {
    const file = new File(["not an image"], "doc.pdf", {
      type: "application/pdf",
    });

    await expect(processPhoto(file)).rejects.toThrow(
      "File is not an image: application/pdf",
    );
  });

  it("does not upscale images smaller than max width", async () => {
    installImageMock(200, 150);

    const canvasSizes: Array<{ width: number; height: number }> = [];
    installCanvasWithSizeCapture(canvasSizes);

    const file = new File(["data"], "small.jpg", { type: "image/jpeg" });
    await processPhoto(file);

    // Both thumbnail and display should keep original 200x150 (no upscale)
    for (const size of canvasSizes) {
      expect(size.width).toBe(200);
      expect(size.height).toBe(150);
    }
  });
});

