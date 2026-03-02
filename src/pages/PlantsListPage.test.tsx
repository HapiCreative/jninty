import "fake-indexeddb/auto";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { clearPouchDB } from "../db/pouchdb/testUtils.ts";
import { plantRepository } from "../db/index.ts";
import { addToIndex, _resetIndex } from "../db/search.ts";
import PlantsListPage from "./PlantsListPage.tsx";

// Mock search module — loadIndex and rebuildIndex are async startup calls
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

beforeEach(async () => {
  await clearPouchDB();
  _resetIndex();
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/plants"]}>
      <PlantsListPage />
    </MemoryRouter>,
  );
}

async function createPlant(overrides: Partial<Parameters<typeof plantRepository.create>[0]> = {}) {
  const plant = await plantRepository.create({
    species: "Tomato",
    type: "vegetable",
    isPerennial: false,
    source: "seed",
    status: "active",
    tags: [],
    ...overrides,
  });
  addToIndex(plant);
  return plant;
}

describe("PlantsListPage", () => {
  it("renders the page header", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Plant Inventory")).toBeInTheDocument();
    });
  });

  it("shows empty state when no plants exist", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No plants yet")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Add your first plant to get started."),
    ).toBeInTheDocument();
  });

  it("renders plants in grid view", async () => {
    await createPlant({ species: "Tomato", nickname: "Big Red" });
    await createPlant({ species: "Basil", type: "herb" });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Big Red")).toBeInTheDocument();
    });

    expect(screen.getByText("Basil")).toBeInTheDocument();
    expect(screen.getByText("2 plants")).toBeInTheDocument();
  });

  it("shows species under nickname on plant cards", async () => {
    await createPlant({ species: "Solanum lycopersicum", nickname: "Cherry Tom" });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Cherry Tom")).toBeInTheDocument();
    });

    expect(screen.getByText("Solanum lycopersicum")).toBeInTheDocument();
  });

  it("displays type and status badges", async () => {
    await createPlant({ species: "Tomato", type: "vegetable", status: "active" });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });

    // "Vegetable" appears in both dropdown and badge — check badge specifically
    const card = screen.getByText("Tomato").closest("a")!;
    expect(within(card).getByText("Vegetable")).toBeInTheDocument();
    expect(within(card).getByText("Active")).toBeInTheDocument();
  });

  it("switches to list view", async () => {
    await createPlant({ species: "Tomato" });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });

    const listButton = screen.getByLabelText("List view");
    await user.click(listButton);

    // Plant should still be visible
    expect(screen.getByText("Tomato")).toBeInTheDocument();
  });

  it("filters by type", async () => {
    await createPlant({ species: "Tomato", type: "vegetable" });
    await createPlant({ species: "Basil", type: "herb" });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
      expect(screen.getByText("Basil")).toBeInTheDocument();
    });

    const typeFilter = screen.getByLabelText("Filter by type");
    await user.selectOptions(typeFilter, "herb");

    await waitFor(() => {
      expect(screen.queryByText("Tomato")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Basil")).toBeInTheDocument();
  });

  it("filters by status", async () => {
    await createPlant({ species: "Active Plant", status: "active" });
    await createPlant({ species: "Dormant Plant", status: "dormant" });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Active Plant")).toBeInTheDocument();
      expect(screen.getByText("Dormant Plant")).toBeInTheDocument();
    });

    const statusFilter = screen.getByLabelText("Filter by status");
    await user.selectOptions(statusFilter, "dormant");

    await waitFor(() => {
      expect(screen.queryByText("Active Plant")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Dormant Plant")).toBeInTheDocument();
  });

  it("shows no-match message when filters return no results", async () => {
    await createPlant({ species: "Tomato", type: "vegetable" });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });

    const typeFilter = screen.getByLabelText("Filter by type");
    await user.selectOptions(typeFilter, "flower");

    await waitFor(() => {
      expect(
        screen.getByText("No plants match your filters"),
      ).toBeInTheDocument();
    });
  });

  it("searches plants using MiniSearch", async () => {
    await createPlant({ species: "Tomato", nickname: "Big Red" });
    await createPlant({ species: "Basil" });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Big Red")).toBeInTheDocument();
      expect(screen.getByText("Basil")).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText("Search plants");
    await user.type(searchInput, "Tomato");

    await waitFor(() => {
      expect(screen.getByText("Big Red")).toBeInTheDocument();
      expect(screen.queryByText("Basil")).not.toBeInTheDocument();
    });
  });

  it("renders the add plant FAB", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Add plant")).toBeInTheDocument();
    });
  });

  it("combines type and status filters", async () => {
    await createPlant({ species: "Active Veggie", type: "vegetable", status: "active" });
    await createPlant({ species: "Dormant Veggie", type: "vegetable", status: "dormant" });
    await createPlant({ species: "Active Herb", type: "herb", status: "active" });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Active Veggie")).toBeInTheDocument();
    });

    const typeFilter = screen.getByLabelText("Filter by type");
    const statusFilter = screen.getByLabelText("Filter by status");

    await user.selectOptions(typeFilter, "vegetable");
    await user.selectOptions(statusFilter, "active");

    await waitFor(() => {
      expect(screen.getByText("Active Veggie")).toBeInTheDocument();
      expect(screen.queryByText("Dormant Veggie")).not.toBeInTheDocument();
      expect(screen.queryByText("Active Herb")).not.toBeInTheDocument();
    });
  });

  it("shows plant count", async () => {
    await createPlant({ species: "Plant A" });
    await createPlant({ species: "Plant B" });
    await createPlant({ species: "Plant C" });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("3 plants")).toBeInTheDocument();
    });
  });

  it("shows singular count for one plant", async () => {
    await createPlant({ species: "Lonely Plant" });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("1 plant")).toBeInTheDocument();
    });
  });
});
