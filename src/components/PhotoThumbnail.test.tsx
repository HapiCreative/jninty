import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "../db/schema.ts";
import PhotoThumbnail from "./PhotoThumbnail.tsx";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PhotoThumbnail", () => {
  it("shows loading skeleton initially", () => {
    render(<PhotoThumbnail photoId="nonexistent" className="h-16 w-16" />);
    const skeleton = screen.getByRole("status", { name: "Loading photo" });
    expect(skeleton).toBeInTheDocument();
    expect(skeleton.className).toContain("animate-pulse");
  });

  it("shows placeholder when photo is not found", async () => {
    render(<PhotoThumbnail photoId="00000000-0000-0000-0000-000000000000" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Photo not found")).toBeInTheDocument();
    });
  });

  it("renders an img when photo exists", async () => {
    const blobUrl = "blob:mock-thumbnail-url";
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue(blobUrl);
    globalThis.URL.revokeObjectURL = vi.fn();

    const id = crypto.randomUUID();
    const thumb = new Blob([new Uint8Array(100)], { type: "image/jpeg" });

    await db.photos.add({
      id,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      thumbnailBlob: thumb,
      originalStored: false,
    });

    render(<PhotoThumbnail photoId={id} alt="My tomato" className="h-20" />);

    await waitFor(() => {
      const img = screen.getByRole("img", { name: "My tomato" });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", blobUrl);
      expect(img.className).toContain("h-20");
    });
  });

  it("revokes blob URL on unmount", async () => {
    const blobUrl = "blob:mock-revoke-test";
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue(blobUrl);
    const revokeSpy = (globalThis.URL.revokeObjectURL = vi.fn());

    const id = crypto.randomUUID();
    await db.photos.add({
      id,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      thumbnailBlob: new Blob([new Uint8Array(50)], { type: "image/jpeg" }),
      originalStored: false,
    });

    const { unmount } = render(
      <PhotoThumbnail photoId={id} alt="test photo" />,
    );

    // Wait for the image to load
    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "test photo" }),
      ).toBeInTheDocument();
    });

    unmount();

    expect(revokeSpy).toHaveBeenCalledWith(blobUrl);
  });
});
