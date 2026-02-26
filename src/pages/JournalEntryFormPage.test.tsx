import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { db } from "../db/schema.ts";
import * as journalRepository from "../db/repositories/journalRepository.ts";
import * as plantRepository from "../db/repositories/plantRepository.ts";
import * as gardenBedRepository from "../db/repositories/gardenBedRepository.ts";
import * as seasonRepository from "../db/repositories/seasonRepository.ts";
import { SettingsProvider } from "../hooks/useSettings.tsx";
import { _resetIndex } from "../db/search.ts";
import JournalEntryFormPage from "./JournalEntryFormPage.tsx";

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
vi.mock("../hooks/usePhotoCapture.ts", () => ({
  usePhotoCapture: () => ({
    capturePhoto: vi.fn(),
    selectPhoto: vi.fn(),
    isProcessing: false,
    error: null,
  }),
}));

beforeEach(async () => {
  await db.delete();
  await db.open();
  _resetIndex();
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

function renderPage() {
  return render(
    <SettingsProvider>
      <MemoryRouter initialEntries={["/journal/new"]}>
        <Routes>
          <Route path="journal/new" element={<JournalEntryFormPage />} />
          <Route path="journal" element={<div>Journal Page</div>} />
        </Routes>
      </MemoryRouter>
    </SettingsProvider>,
  );
}

describe("JournalEntryFormPage", () => {
  it("renders the form with all fields", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "New Journal Entry" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Activity type" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Plant")).toBeInTheDocument();
    expect(screen.getByLabelText("Garden Bed")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText(/Body/)).toBeInTheDocument();
    expect(screen.getByLabelText("Milestone")).toBeInTheDocument();
  });

  it("shows validation error when no activity type is selected", async () => {
    const user = userEvent.setup();
    renderPage();

    // Fill body but skip activity type
    await user.type(screen.getByLabelText(/Body/), "Some note");
    await user.click(screen.getByRole("button", { name: "Save Entry" }));

    await waitFor(() => {
      expect(
        screen.getByText("Activity type is required."),
      ).toBeInTheDocument();
    });
  });

  it("shows validation error when body is empty", async () => {
    const user = userEvent.setup();
    renderPage();

    // Select activity but leave body empty
    await user.click(screen.getByText("Watering"));
    await user.click(screen.getByRole("button", { name: "Save Entry" }));

    await waitFor(() => {
      expect(
        screen.getByText("Body text is required."),
      ).toBeInTheDocument();
    });
  });

  it("shows milestone type required when milestone is toggled on", async () => {
    const user = userEvent.setup();
    renderPage();

    // Select "General" activity type (not Milestone, to avoid name collision)
    await user.click(screen.getByText("General"));
    await user.type(screen.getByLabelText(/Body/), "Big day");
    // Toggle milestone switch on
    await user.click(screen.getByRole("switch", { name: "Milestone" }));

    await user.click(screen.getByRole("button", { name: "Save Entry" }));

    await waitFor(() => {
      expect(
        screen.getByText("Select a milestone type."),
      ).toBeInTheDocument();
    });
  });

  it("shows harvest weight field only when activity is harvest", async () => {
    const user = userEvent.setup();
    renderPage();

    // Not visible initially
    expect(screen.queryByLabelText("Harvest Weight (g)")).not.toBeInTheDocument();

    // Select harvest activity
    await user.click(screen.getByText("Harvest"));

    // Now visible
    expect(screen.getByLabelText("Harvest Weight (g)")).toBeInTheDocument();

    // Switch to different activity
    await user.click(screen.getByText("Watering"));

    // Hidden again
    expect(screen.queryByLabelText("Harvest Weight (g)")).not.toBeInTheDocument();
  });

  it("shows milestone type picker when milestone is toggled on", async () => {
    const user = userEvent.setup();
    renderPage();

    // Not visible initially
    expect(
      screen.queryByLabelText(/Milestone Type/),
    ).not.toBeInTheDocument();

    // Toggle milestone on
    await user.click(screen.getByLabelText("Milestone"));

    // Now visible
    expect(screen.getByLabelText(/Milestone Type/)).toBeInTheDocument();
    expect(screen.getByText("First Sprout")).toBeInTheDocument();
    expect(screen.getByText("First Flower")).toBeInTheDocument();
  });

  it("saves a basic entry and navigates to journal", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("General"));
    await user.type(screen.getByLabelText(/Body/), "A good garden day");
    await user.click(screen.getByRole("button", { name: "Save Entry" }));

    await waitFor(() => {
      expect(screen.getByText("Journal Page")).toBeInTheDocument();
    });

    const entries = await journalRepository.getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.body).toBe("A good garden day");
    expect(entries[0]?.activityType).toBe("general");
  });

  it("saves entry with plant and garden bed", async () => {
    const plant = await plantRepository.create({
      species: "Tomato",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });
    const bed = await gardenBedRepository.create({
      name: "Raised Bed A",
      type: "vegetable_bed",
      gridX: 0,
      gridY: 0,
      gridWidth: 4,
      gridHeight: 2,
      shape: "rectangle" as const,
      color: "#7dbf4e",
    });

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Watering"));

    // Wait for dropdown options to load
    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText("Plant"), plant.id);
    await user.selectOptions(screen.getByLabelText("Garden Bed"), bed.id);
    await user.type(screen.getByLabelText(/Body/), "Watered everything");
    await user.click(screen.getByRole("button", { name: "Save Entry" }));

    await waitFor(() => {
      expect(screen.getByText("Journal Page")).toBeInTheDocument();
    });

    const entries = await journalRepository.getAll();
    expect(entries[0]?.plantInstanceId).toBe(plant.id);
    expect(entries[0]?.bedId).toBe(bed.id);
  });

  it("saves harvest entry with weight", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Harvest"));
    await user.type(screen.getByLabelText(/Body/), "Great harvest today");
    await user.type(screen.getByLabelText("Harvest Weight (g)"), "450");
    await user.click(screen.getByRole("button", { name: "Save Entry" }));

    await waitFor(() => {
      expect(screen.getByText("Journal Page")).toBeInTheDocument();
    });

    const entries = await journalRepository.getAll();
    expect(entries[0]?.activityType).toBe("harvest");
    expect(entries[0]?.harvestWeight).toBe(450);
  });

  it("saves milestone entry", async () => {
    const user = userEvent.setup();
    renderPage();

    // Select "General" activity type first
    await user.click(screen.getByText("General"));
    await user.type(screen.getByLabelText(/Body/), "First flower appeared!");
    // Toggle milestone switch on
    await user.click(screen.getByRole("switch", { name: "Milestone" }));
    await user.selectOptions(
      screen.getByLabelText(/Milestone Type/),
      "first_flower",
    );
    await user.click(screen.getByRole("button", { name: "Save Entry" }));

    await waitFor(() => {
      expect(screen.getByText("Journal Page")).toBeInTheDocument();
    });

    const entries = await journalRepository.getAll();
    expect(entries[0]?.isMilestone).toBe(true);
    expect(entries[0]?.milestoneType).toBe("first_flower");
  });

  it("cancel button navigates back", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(screen.getByText("Journal Page")).toBeInTheDocument();
    });
  });
});
