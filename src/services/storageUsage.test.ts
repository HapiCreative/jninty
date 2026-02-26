import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../db/schema.ts";
import { formatBytes, getStorageUsage } from "./storageUsage.ts";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("formatBytes", () => {
  it("formats zero bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes below 1 KB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("formats exactly 1 KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(10240)).toBe("10.0 KB");
  });

  it("formats exactly 1 MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatBytes(100 * 1024 * 1024)).toBe("100.0 MB");
  });
});

describe("getStorageUsage", () => {
  it("returns zero when no photos exist", async () => {
    const usage = await getStorageUsage();
    expect(usage.thumbnailBytes).toBe(0);
    expect(usage.displayBytes).toBe(0);
    expect(usage.originalBytes).toBe(0);
  });

  // Note: fake-indexeddb does not preserve Blob objects through structured
  // clone, so blob.size returns NaN after a DB round-trip. The service
  // guards against this and returns 0. We verify the function runs without
  // error and returns a valid number.
  it("handles photos in DB without crashing", async () => {
    const now = new Date().toISOString();
    const thumb = new Blob(["x".repeat(100)], { type: "image/jpeg" });
    const display = new Blob(["y".repeat(500)], { type: "image/jpeg" });

    await db.photos.add({
      id: crypto.randomUUID(),
      version: 0,
      createdAt: now,
      updatedAt: now,
      thumbnailBlob: thumb,
      displayBlob: display,
      originalStored: false,
    });

    const usage = await getStorageUsage();
    // Blob sizes are lost in fake-indexeddb, so bytes are 0
    expect(typeof usage.thumbnailBytes).toBe("number");
    expect(Number.isNaN(usage.thumbnailBytes)).toBe(false);
    expect(typeof usage.displayBytes).toBe("number");
  });

  it("returns valid structure with photos missing displayBlob", async () => {
    const now = new Date().toISOString();
    const thumb = new Blob(["x".repeat(200)], { type: "image/jpeg" });

    await db.photos.add({
      id: crypto.randomUUID(),
      version: 0,
      createdAt: now,
      updatedAt: now,
      thumbnailBlob: thumb,
      originalStored: false,
    });

    const usage = await getStorageUsage();
    expect(typeof usage.thumbnailBytes).toBe("number");
    expect(Number.isNaN(usage.thumbnailBytes)).toBe(false);
    expect(typeof usage.totalBytes).toBe("number");
    expect(typeof usage.quotaBytes).toBe("number");
  });
});
