import "fake-indexeddb/auto";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../db/schema.ts";
import PhotoLightbox from "./PhotoLightbox.tsx";

// Mock photoRepository
vi.mock("../db/repositories/photoRepository.ts", () => ({
  getDisplayBlob: vi.fn().mockResolvedValue(
    new Blob(["display-data"], { type: "image/jpeg" }),
  ),
}));

// Mock URL.createObjectURL / revokeObjectURL for jsdom
globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
globalThis.URL.revokeObjectURL = vi.fn();

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("PhotoLightbox", () => {
  const photoIds = ["photo-1", "photo-2", "photo-3"];
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
  });

  it("renders with close button and counter", () => {
    render(
      <PhotoLightbox
        photoIds={photoIds}
        initialIndex={0}
        onClose={onClose}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Photo viewer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close photo viewer" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("calls onClose when Escape is pressed", () => {
    render(
      <PhotoLightbox
        photoIds={photoIds}
        initialIndex={0}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button is clicked", () => {
    render(
      <PhotoLightbox
        photoIds={photoIds}
        initialIndex={0}
        onClose={onClose}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Close photo viewer" }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows navigation buttons when there are multiple photos", () => {
    render(
      <PhotoLightbox
        photoIds={photoIds}
        initialIndex={1}
        onClose={onClose}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Previous photo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Next photo" }),
    ).toBeInTheDocument();
  });

  it("hides previous button on first photo", () => {
    render(
      <PhotoLightbox
        photoIds={photoIds}
        initialIndex={0}
        onClose={onClose}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Previous photo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Next photo" }),
    ).toBeInTheDocument();
  });

  it("hides next button on last photo", () => {
    render(
      <PhotoLightbox
        photoIds={photoIds}
        initialIndex={2}
        onClose={onClose}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Previous photo" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Next photo" }),
    ).not.toBeInTheDocument();
  });

  it("does not show counter for single photo", () => {
    render(
      <PhotoLightbox
        photoIds={["photo-1"]}
        initialIndex={0}
        onClose={onClose}
      />,
    );

    expect(screen.queryByText("1 / 1")).not.toBeInTheDocument();
  });

  it("navigates with arrow keys", () => {
    render(
      <PhotoLightbox
        photoIds={photoIds}
        initialIndex={0}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText("3 / 3")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("prevents body scroll when open", () => {
    const { unmount } = render(
      <PhotoLightbox
        photoIds={photoIds}
        initialIndex={0}
        onClose={onClose}
      />,
    );

    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
