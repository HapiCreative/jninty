import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { db } from "../db/schema.ts";
import * as plantRepository from "../db/repositories/plantRepository.ts";
import * as journalRepository from "../db/repositories/journalRepository.ts";
import * as taskRepository from "../db/repositories/taskRepository.ts";
import { addToIndex, _resetIndex } from "../db/search.ts";
import PlantDetailPage from "./PlantDetailPage.tsx";

// Mock search module
vi.mock("../db/search.ts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../db/search.ts")>();
  return {
    ...actual,
    loadIndex: vi.fn().mockResolvedValue(true),
    rebuildIndex: vi.fn().mockResolvedValue(0),
    serializeIndex: vi.fn().mockResolvedValue(undefined),
    removeFromIndex: vi.fn(),
  };
});

import { removeFromIndex, serializeIndex } from "../db/search.ts";

beforeEach(async () => {
  await db.delete();
  await db.open();
  _resetIndex();
  vi.clearAllMocks();
});

function renderDetailPage(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/plants/${id}`]}>
      <Routes>
        <Route path="plants/:id" element={<PlantDetailPage />} />
        <Route path="plants/:id/edit" element={<div>Edit Page</div>} />
        <Route path="plants" element={<div>Plants List</div>} />
        <Route path="quick-log" element={<div>Quick Log</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PlantDetailPage", () => {
  it("shows plant not found for invalid ID", async () => {
    renderDetailPage("non-existent-id");

    await waitFor(() => {
      expect(screen.getByText("Plant not found")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Back to Plant Inventory"),
    ).toBeInTheDocument();
  });

  it("displays plant name and species", async () => {
    const plant = await plantRepository.create({
      species: "Solanum lycopersicum",
      nickname: "Big Red",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    renderDetailPage(plant.id);

    await waitFor(() => {
      expect(screen.getByText("Big Red")).toBeInTheDocument();
    });

    expect(screen.getByText("Solanum lycopersicum")).toBeInTheDocument();
  });

  it("displays type and status badges", async () => {
    const plant = await plantRepository.create({
      species: "Tomato",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    renderDetailPage(plant.id);

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });

    expect(screen.getByText("Vegetable")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("displays plant details card", async () => {
    const plant = await plantRepository.create({
      species: "Apple",
      variety: "Honeycrisp",
      type: "fruit_tree",
      isPerennial: true,
      source: "nursery",
      status: "active",
      tags: [],
      dateAcquired: "2024-06-15",
      careNotes: "Needs annual pruning",
    });

    renderDetailPage(plant.id);

    await waitFor(() => {
      expect(screen.getByText("Apple")).toBeInTheDocument();
    });

    expect(screen.getByText("Honeycrisp")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument(); // isPerennial
    expect(screen.getByText("Nursery")).toBeInTheDocument(); // source
    expect(screen.getByText("Jun 15, 2024")).toBeInTheDocument(); // formatted date
    expect(screen.getByText("Needs annual pruning")).toBeInTheDocument();
  });

  it("displays tags as badges", async () => {
    const plant = await plantRepository.create({
      species: "Tomato",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: ["heirloom", "raised bed"],
    });

    renderDetailPage(plant.id);

    await waitFor(() => {
      expect(screen.getByText("heirloom")).toBeInTheDocument();
    });

    expect(screen.getByText("raised bed")).toBeInTheDocument();
  });

  it("shows Quick Log button", async () => {
    const plant = await plantRepository.create({
      species: "Tomato",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    renderDetailPage(plant.id);

    await waitFor(() => {
      expect(screen.getByText("Quick Log")).toBeInTheDocument();
    });
  });

  it("shows journal entries section", async () => {
    const plant = await plantRepository.create({
      species: "Tomato",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    await journalRepository.create({
      plantInstanceId: plant.id,
      activityType: "watering",
      title: "Watered the tomato",
      body: "Gave it a good soak",
      photoIds: [],
      isMilestone: false,
      seasonId: "00000000-0000-0000-0000-000000000099",
    });

    renderDetailPage(plant.id);

    await waitFor(() => {
      expect(screen.getByText("Watered the tomato")).toBeInTheDocument();
    });

    expect(screen.getByText("Gave it a good soak")).toBeInTheDocument();
  });

  it("shows empty journal entries message", async () => {
    const plant = await plantRepository.create({
      species: "Tomato",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    renderDetailPage(plant.id);

    await waitFor(() => {
      expect(
        screen.getByText("No journal entries yet."),
      ).toBeInTheDocument();
    });
  });

  it("shows tasks section with pending tasks", async () => {
    const plant = await plantRepository.create({
      species: "Tomato",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    await taskRepository.create({
      title: "Water the tomato",
      plantInstanceId: plant.id,
      dueDate: "2026-03-01",
      priority: "normal",
      isCompleted: false,
      isAutoGenerated: false,
    });

    renderDetailPage(plant.id);

    await waitFor(() => {
      expect(screen.getByText("Water the tomato")).toBeInTheDocument();
    });

    expect(screen.getByText("1 pending")).toBeInTheDocument();
    expect(screen.getByText("Due: Mar 1, 2026")).toBeInTheDocument();
  });

  it("shows Edit Plant and Delete buttons", async () => {
    const plant = await plantRepository.create({
      species: "Tomato",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    renderDetailPage(plant.id);

    await waitFor(() => {
      expect(screen.getByText("Edit Plant")).toBeInTheDocument();
    });

    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("opens delete confirmation dialog", async () => {
    const plant = await plantRepository.create({
      species: "Tomato",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    const user = userEvent.setup();
    renderDetailPage(plant.id);

    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(screen.getByText("Delete Tomato?")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/This plant will be removed/),
    ).toBeInTheDocument();
  });

  it("closes delete dialog on Cancel", async () => {
    const plant = await plantRepository.create({
      species: "Tomato",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    const user = userEvent.setup();
    renderDetailPage(plant.id);

    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(screen.getByText("Delete Tomato?")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(screen.queryByText("Delete Tomato?")).not.toBeInTheDocument();
    });
  });

  it("soft-deletes plant and navigates to list", async () => {
    const plant = await plantRepository.create({
      species: "Tomato",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });
    addToIndex(plant);

    const user = userEvent.setup();
    renderDetailPage(plant.id);

    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    // Open dialog and confirm delete
    await user.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(screen.getByText("Delete Tomato?")).toBeInTheDocument();
    });

    // Click the Delete button inside the dialog (not the one that opens it)
    const dialog = screen.getByRole("dialog");
    const confirmBtn = dialog.querySelector("button:last-child")!;
    await user.click(confirmBtn);

    // Should navigate to plants list
    await waitFor(() => {
      expect(screen.getByText("Plants List")).toBeInTheDocument();
    });

    // Verify plant is soft-deleted
    const deleted = await plantRepository.getById(plant.id);
    expect(deleted).toBeUndefined();

    // Verify search index was updated
    expect(removeFromIndex).toHaveBeenCalledWith(plant.id);
    expect(serializeIndex).toHaveBeenCalled();
  });

  it("closes delete dialog on Escape key", async () => {
    const plant = await plantRepository.create({
      species: "Tomato",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    const user = userEvent.setup();
    renderDetailPage(plant.id);

    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(screen.getByText("Delete Tomato?")).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByText("Delete Tomato?")).not.toBeInTheDocument();
    });
  });
});
