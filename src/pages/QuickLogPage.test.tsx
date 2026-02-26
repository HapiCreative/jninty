import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { db } from "../db/schema.ts";
import * as plantRepository from "../db/repositories/plantRepository.ts";
import * as journalRepository from "../db/repositories/journalRepository.ts";
import * as seasonRepository from "../db/repositories/seasonRepository.ts";
import { SettingsProvider } from "../hooks/useSettings.tsx";
import { _resetIndex } from "../db/search.ts";
import QuickLogPage from "./QuickLogPage.tsx";

// Mock search module
vi.mock("../db/search.ts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../db/search.ts")>();
  return {
    ...actual,
    loadIndex: vi.fn().mockResolvedValue(true),
    rebuildIndex: vi.fn().mockResolvedValue(0),
    serializeIndex: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock usePhotoCapture — camera/file APIs are not available in jsdom
const mockCapturePhoto = vi.fn();
const mockSelectPhoto = vi.fn();
vi.mock("../hooks/usePhotoCapture.ts", () => ({
  usePhotoCapture: () => ({
    capturePhoto: mockCapturePhoto,
    selectPhoto: mockSelectPhoto,
    isProcessing: false,
    error: null,
  }),
}));

// Mock URL.createObjectURL/revokeObjectURL (not available in jsdom)
let blobUrlCounter = 0;
vi.stubGlobal("URL", {
  ...URL,
  createObjectURL: vi.fn(() => `blob:mock-url-${++blobUrlCounter}`),
  revokeObjectURL: vi.fn(),
});

beforeEach(async () => {
  await db.delete();
  await db.open();
  _resetIndex();
  blobUrlCounter = 0;
  vi.clearAllMocks();

  // Seed an active season (migration only runs on upgrade, not fresh DB)
  await seasonRepository.create({
    name: "2026 Growing Season",
    year: 2026,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    isActive: true,
  });
});

function renderPage(initialEntries = ["/quick-log"]) {
  return render(
    <SettingsProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="quick-log" element={<QuickLogPage />} />
          <Route path="journal" element={<div>Journal Page</div>} />
        </Routes>
      </MemoryRouter>
    </SettingsProvider>,
  );
}

function makeProcessedPhoto() {
  return {
    thumbnailBlob: new Blob(["thumb"], { type: "image/jpeg" }),
    displayBlob: new Blob(["display"], { type: "image/jpeg" }),
    width: 800,
    height: 600,
  };
}

describe("QuickLogPage", () => {
  it("renders the page header and photo buttons", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Quick Log" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Take Photo")).toBeInTheDocument();
    expect(screen.getByText("Gallery")).toBeInTheDocument();
  });

  it("renders plant selector, note, and activity chips", () => {
    renderPage();

    expect(screen.getByLabelText("Select plant")).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toBeInTheDocument();
    expect(screen.getByText("Watering")).toBeInTheDocument();
    expect(screen.getByText("Pest")).toBeInTheDocument();
    expect(screen.getByText("Harvest")).toBeInTheDocument();
    expect(screen.getByText("General")).toBeInTheDocument();
  });

  it("shows validation error when saving without photo or note", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(
        screen.getByText("Add a photo or note to save."),
      ).toBeInTheDocument();
    });
  });

  it("saves an entry with just a note (no photo)", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Note"), "Tomatoes looking great");
    await user.click(screen.getByRole("button", { name: "Save" }));

    // Should show success and navigate
    await waitFor(() => {
      expect(screen.getByText("Saved!")).toBeInTheDocument();
    });

    // Verify entry was created
    const entries = await journalRepository.getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.body).toBe("Tomatoes looking great");
    expect(entries[0]?.activityType).toBe("general");
  });

  it("saves an entry with photo and note", async () => {
    mockSelectPhoto.mockResolvedValueOnce(makeProcessedPhoto());

    const user = userEvent.setup();
    renderPage();

    // Select a photo
    await user.click(screen.getByText("Gallery"));

    await waitFor(() => {
      expect(screen.getByAltText("Captured photo")).toBeInTheDocument();
    });

    // Type a note
    await user.type(screen.getByLabelText("Note"), "New bloom today");

    // Select activity type
    await user.click(screen.getByText("Harvest"));

    // Save
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Saved!")).toBeInTheDocument();
    });

    const entries = await journalRepository.getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.body).toBe("New bloom today");
    expect(entries[0]?.activityType).toBe("harvest");
    expect(entries[0]?.photoIds).toHaveLength(1);
  });

  it("pre-selects plant from query param", async () => {
    const plant = await plantRepository.create({
      species: "Tomato",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    renderPage([`/quick-log?plantId=${plant.id}`]);

    await waitFor(() => {
      const select = screen.getByLabelText(
        "Select plant",
      ) as HTMLSelectElement;
      expect(select.value).toBe(plant.id);
    });
  });

  it("saves entry linked to selected plant", async () => {
    const plant = await plantRepository.create({
      species: "Basil",
      type: "herb",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    const user = userEvent.setup();
    renderPage();

    // Wait for plants to load, then select
    await waitFor(() => {
      expect(screen.getByText("Basil")).toBeInTheDocument();
    });

    await user.selectOptions(
      screen.getByLabelText("Select plant"),
      plant.id,
    );
    await user.type(screen.getByLabelText("Note"), "Smells wonderful");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Saved!")).toBeInTheDocument();
    });

    const entries = await journalRepository.getAll();
    expect(entries[0]?.plantInstanceId).toBe(plant.id);
  });

  it("allows selecting and deselecting activity type", async () => {
    const user = userEvent.setup();
    renderPage();

    const wateringBtn = screen.getByText("Watering");

    // Select
    await user.click(wateringBtn);
    expect(wateringBtn).toHaveClass("bg-green-700");

    // Deselect
    await user.click(wateringBtn);
    expect(wateringBtn).not.toHaveClass("bg-green-700");
  });

  it("can remove a captured photo", async () => {
    mockSelectPhoto.mockResolvedValueOnce(makeProcessedPhoto());

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Gallery"));

    await waitFor(() => {
      expect(screen.getByAltText("Captured photo")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Remove photo"));

    expect(screen.queryByAltText("Captured photo")).not.toBeInTheDocument();
    expect(screen.getByText("Take Photo")).toBeInTheDocument();
  });
});
