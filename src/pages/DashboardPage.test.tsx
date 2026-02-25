import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { formatISO, addDays, subDays } from "date-fns";
import { db } from "../db/schema.ts";
import * as taskRepository from "../db/repositories/taskRepository.ts";
import * as plantRepository from "../db/repositories/plantRepository.ts";
import DashboardPage from "./DashboardPage.tsx";

beforeEach(async () => {
  await db.delete();
  await db.open();
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
    <MemoryRouter initialEntries={["/"]}>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  it("shows 'No tasks this week' when there are no tasks", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No tasks this week.")).toBeInTheDocument();
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
    // Task 14 days away should NOT appear
    expect(screen.queryByText("Far future task")).not.toBeInTheDocument();
  });

  it("shows overdue tasks with red highlight", async () => {
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
    expect(screen.getByText("No tasks this week.")).toBeInTheDocument();
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

  it("has a 'View all' link to /tasks", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("This Week's Tasks"),
      ).toBeInTheDocument();
    });

    const link = screen.getByRole("link", { name: "View all" });
    expect(link).toHaveAttribute("href", "/tasks");
  });
});
