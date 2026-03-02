import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { formatISO, addDays, subDays } from "date-fns";
import { clearPouchDB } from "../db/pouchdb/testUtils.ts";
import { taskRepository, plantRepository, journalRepository } from "../db/index.ts";
import { SettingsProvider } from "../hooks/useSettings.tsx";
import { ToastProvider } from "../components/ui/Toast.tsx";
import DashboardPage from "./DashboardPage.tsx";

beforeEach(async () => {
  await clearPouchDB();
  vi.clearAllMocks();
});

function futureDate(days: number): string {
  return formatISO(addDays(new Date(), days), { representation: "date" });
}

function pastDate(days: number): string {
  return formatISO(subDays(new Date(), days), { representation: "date" });
}

function renderPage() {
  return render(
    <SettingsProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={["/"]}>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    </SettingsProvider>,
  );
}

describe("DashboardPage", () => {
  // ── First-time experience ──

  it("shows welcome card when there are no plants", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Welcome to Jninty!")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Start by adding your first plant."),
    ).toBeInTheDocument();
    // Welcome card + quick action both link to /plants/new
    const addPlantLinks = screen.getAllByRole("link", { name: /Add Plant/ });
    expect(addPlantLinks.length).toBeGreaterThanOrEqual(1);
    expect(addPlantLinks[0]).toHaveAttribute("href", "/plants/new");
  });

  it("shows growing zone nudge when there are no plants", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/Set your growing zone/),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("hides welcome card and zone nudge when plants exist", async () => {
    await plantRepository.create({
      species: "Tomato",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("What's happening in your garden today?"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Welcome to Jninty!")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Set your growing zone/),
    ).not.toBeInTheDocument();
  });

  // ── "Today in your garden" prompt card ──

  it("shows the prompt card linking to quick-log", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("What's happening in your garden today?"),
      ).toBeInTheDocument();
    });
  });

  it("shows 'Last logged' time when journal entries exist", async () => {
    await journalRepository.create({
      activityType: "watering",
      body: "Watered the roses",
      photoIds: [],
      isMilestone: false,
      seasonId: "00000000-0000-0000-0000-000000000099",
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Last logged:/)).toBeInTheDocument();
    });
  });

  // ── This Week's Tasks ──

  it("shows 'No tasks this week' when there are no tasks", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/No tasks this week/),
      ).toBeInTheDocument();
    });
  });

  it("shows upcoming tasks due within 7 days", async () => {
    await taskRepository.create({
      title: "Water garden",
      dueDate: futureDate(3),
      priority: "normal",
      isCompleted: false,
    });
    await taskRepository.create({
      title: "Far future task",
      dueDate: futureDate(14),
      priority: "low",
      isCompleted: false,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Water garden")).toBeInTheDocument();
    });
    expect(screen.queryByText("Far future task")).not.toBeInTheDocument();
  });

  it("shows overdue tasks with overdue label", async () => {
    await taskRepository.create({
      title: "Overdue watering",
      dueDate: pastDate(2),
      priority: "urgent",
      isCompleted: false,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Overdue watering")).toBeInTheDocument();
    });
    expect(screen.getByText(/Overdue \u2014/)).toBeInTheDocument();
  });

  it("does not show completed tasks", async () => {
    const task = await taskRepository.create({
      title: "Done task",
      dueDate: futureDate(1),
      priority: "normal",
      isCompleted: false,
    });
    await taskRepository.complete(task.id);

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("This Week's Tasks"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Done task")).not.toBeInTheDocument();
    expect(screen.getByText(/No tasks this week/)).toBeInTheDocument();
  });

  it("shows linked plant name on dashboard tasks", async () => {
    const plant = await plantRepository.create({
      species: "Basil",
      type: "herb",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    await taskRepository.create({
      title: "Harvest basil",
      dueDate: futureDate(2),
      priority: "normal",
      isCompleted: false,
      plantInstanceId: plant.id,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Harvest basil")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/Basil/)).toBeInTheDocument();
    });
  });

  it("has a 'See all tasks' link to /tasks", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("This Week's Tasks"),
      ).toBeInTheDocument();
    });

    const link = screen.getByRole("link", { name: /See all tasks/ });
    expect(link).toHaveAttribute("href", "/tasks");
  });

  it("completes a task when checkbox is clicked", async () => {
    await taskRepository.create({
      title: "Water the tomatoes",
      dueDate: futureDate(1),
      priority: "normal",
      isCompleted: false,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Water the tomatoes")).toBeInTheDocument();
    });

    const checkbox = screen.getByRole("button", {
      name: /Complete task: Water the tomatoes/,
    });
    await userEvent.click(checkbox);

    await waitFor(() => {
      expect(
        screen.queryByText("Water the tomatoes"),
      ).not.toBeInTheDocument();
    });
  });

  // ── Recent Journal ──

  it("shows empty state when no journal entries exist", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/Start logging your garden journey/),
      ).toBeInTheDocument();
    });
  });

  it("shows recent journal entries", async () => {
    await journalRepository.create({
      activityType: "watering",
      body: "Watered the basil this morning",
      photoIds: [],
      isMilestone: false,
      seasonId: "00000000-0000-0000-0000-000000000099",
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("Watered the basil this morning"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Watering")).toBeInTheDocument();
  });

  it("shows plant name on journal entries", async () => {
    const plant = await plantRepository.create({
      species: "Rosemary",
      type: "herb",
      isPerennial: true,
      source: "nursery",
      status: "active",
      tags: [],
    });

    await journalRepository.create({
      activityType: "pruning",
      body: "Trimmed back the rosemary",
      plantInstanceId: plant.id,
      photoIds: [],
      isMilestone: false,
      seasonId: "00000000-0000-0000-0000-000000000099",
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Rosemary")).toBeInTheDocument();
    });
    expect(screen.getByText("Pruning")).toBeInTheDocument();
  });

  it("has a 'See all entries' link to /journal", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Recent Journal")).toBeInTheDocument();
    });

    const link = screen.getByRole("link", { name: /See all entries/ });
    expect(link).toHaveAttribute("href", "/journal");
  });

  // ── Quick Actions ──

  it("shows quick action buttons", async () => {
    renderPage();

    // Wait for loading to finish (skeleton -> real content)
    await waitFor(() => {
      expect(
        screen.getByText("What's happening in your garden today?"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Log Entry")).toBeInTheDocument();
    // "Add Plant" appears in both the welcome card and quick actions when no plants exist
    expect(screen.getAllByText("Add Plant").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Add Task")).toBeInTheDocument();
  });
});
