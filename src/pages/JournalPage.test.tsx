import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { clearPouchDB } from "../db/pouchdb/testUtils.ts";
import { journalRepository, plantRepository } from "../db/index.ts";
import { SettingsProvider } from "../hooks/useSettings.tsx";
import { addToIndex, _resetIndex } from "../db/search.ts";
import JournalPage from "./JournalPage.tsx";

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

// Mock react-window — jsdom doesn't support layout measurement
vi.mock("react-window", async () => {
  const React = await import("react");
  return {
    FixedSizeList: ({
      children: Row,
      itemCount,
      itemData,
    }: {
      children: React.ComponentType<{
        index: number;
        style: React.CSSProperties;
        data: unknown;
      }>;
      itemCount: number;
      itemData: unknown;
      height: number;
      width: string;
      itemSize: number;
      overscanCount: number;
    }) => {
      const items = [];
      for (let i = 0; i < itemCount; i++) {
        items.push(
          React.createElement(Row, {
            key: i,
            index: i,
            style: {},
            data: itemData,
          }),
        );
      }
      return React.createElement("div", { "data-testid": "virtual-list" }, items);
    },
  };
});

beforeEach(async () => {
  await clearPouchDB();
  _resetIndex();
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <SettingsProvider>
      <MemoryRouter initialEntries={["/journal"]}>
        <JournalPage />
      </MemoryRouter>
    </SettingsProvider>,
  );
}

async function createEntry(
  overrides: Partial<Parameters<typeof journalRepository.create>[0]> = {},
) {
  const entry = await journalRepository.create({
    activityType: "general",
    body: "Test entry",
    photoIds: [],
    isMilestone: false,
    seasonId: "00000000-0000-0000-0000-000000000099",
    ...overrides,
  });
  addToIndex(entry);
  return entry;
}

describe("JournalPage", () => {
  it("renders the page header", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Journal")).toBeInTheDocument();
    });
  });

  it("shows empty state when no entries exist", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("No journal entries yet"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Start logging with the + button below."),
    ).toBeInTheDocument();
  });

  it("renders journal entries in the feed", async () => {
    await createEntry({ body: "First tomato harvested!" });
    await createEntry({ body: "Basil needs water" });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("First tomato harvested!"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Basil needs water")).toBeInTheDocument();
    expect(screen.getByText("2 entries")).toBeInTheDocument();
  });

  it("shows entry count", async () => {
    await createEntry({ body: "Entry 1" });
    await createEntry({ body: "Entry 2" });
    await createEntry({ body: "Entry 3" });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("3 entries")).toBeInTheDocument();
    });
  });

  it("shows singular count for one entry", async () => {
    await createEntry({ body: "Only entry" });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("1 entry")).toBeInTheDocument();
    });
  });

  it("displays activity type badge on entries", async () => {
    await createEntry({
      body: "Watered the roses",
      activityType: "watering",
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Watered the roses")).toBeInTheDocument();
    });

    // "Watering" appears in both the filter dropdown and the entry badge
    const wateringTexts = screen.getAllByText("Watering");
    expect(wateringTexts.length).toBeGreaterThanOrEqual(2);
  });

  it("shows linked plant name on entries", async () => {
    const plant = await plantRepository.create({
      species: "Tomato",
      nickname: "Big Red",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    await createEntry({
      body: "Looking healthy",
      plantInstanceId: plant.id,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Looking healthy")).toBeInTheDocument();
    });

    // "Big Red" appears in both the plant filter dropdown and the entry row.
    // Plant names load asynchronously via usePouchQuery, so wait for them.
    await waitFor(() => {
      const bigRedTexts = screen.getAllByText("Big Red");
      expect(bigRedTexts.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("filters by activity type", async () => {
    await createEntry({
      body: "Watering entry",
      activityType: "watering",
    });
    await createEntry({
      body: "Harvest entry",
      activityType: "harvest",
    });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Watering entry")).toBeInTheDocument();
      expect(screen.getByText("Harvest entry")).toBeInTheDocument();
    });

    const activityFilter = screen.getByLabelText("Filter by activity");
    await user.selectOptions(activityFilter, "watering");

    await waitFor(() => {
      expect(screen.getByText("Watering entry")).toBeInTheDocument();
      expect(
        screen.queryByText("Harvest entry"),
      ).not.toBeInTheDocument();
    });
  });

  it("filters by plant", async () => {
    const tomato = await plantRepository.create({
      species: "Tomato",
      type: "vegetable",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });
    const basil = await plantRepository.create({
      species: "Basil",
      type: "herb",
      isPerennial: false,
      source: "seed",
      status: "active",
      tags: [],
    });

    await createEntry({
      body: "Tomato entry",
      plantInstanceId: tomato.id,
    });
    await createEntry({
      body: "Basil entry",
      plantInstanceId: basil.id,
    });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Tomato entry")).toBeInTheDocument();
      expect(screen.getByText("Basil entry")).toBeInTheDocument();
    });

    const plantFilter = screen.getByLabelText("Filter by plant");
    await user.selectOptions(plantFilter, tomato.id);

    await waitFor(() => {
      expect(screen.getByText("Tomato entry")).toBeInTheDocument();
      expect(
        screen.queryByText("Basil entry"),
      ).not.toBeInTheDocument();
    });
  });

  it("shows no-match message when filters return no results", async () => {
    await createEntry({
      body: "A watering entry",
      activityType: "watering",
    });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("A watering entry")).toBeInTheDocument();
    });

    const activityFilter = screen.getByLabelText("Filter by activity");
    await user.selectOptions(activityFilter, "harvest");

    await waitFor(() => {
      expect(
        screen.getByText("No entries match your filters"),
      ).toBeInTheDocument();
    });
  });

  it("searches entries using MiniSearch", async () => {
    await createEntry({ body: "Tomatoes are growing well" });
    await createEntry({ body: "Basil needs pruning" });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("Tomatoes are growing well"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Basil needs pruning"),
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText("Search journal");
    await user.type(searchInput, "Tomato");

    await waitFor(() => {
      expect(
        screen.getByText("Tomatoes are growing well"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Basil needs pruning"),
      ).not.toBeInTheDocument();
    });
  });

  it("renders the add entry FAB", async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByLabelText("Add journal entry"),
      ).toBeInTheDocument();
    });
  });

  it("FAB shows quick log and new entry options when clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByLabelText("Add journal entry"),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Add journal entry"));

    expect(screen.getByText("Quick Log")).toBeInTheDocument();
    expect(screen.getByText("New Entry")).toBeInTheDocument();
  });

  it("opens entry detail overlay when clicking an entry", async () => {
    await createEntry({ body: "Detailed entry body text" });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("Detailed entry body text"),
      ).toBeInTheDocument();
    });

    // Click on the entry row button
    const entryButton = screen.getByRole("button", {
      name: /Detailed entry body text/,
    });
    await user.click(entryButton);

    // Should show the detail overlay
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("closes entry detail overlay", async () => {
    await createEntry({ body: "Closeable entry" });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Closeable entry")).toBeInTheDocument();
    });

    const entryButton = screen.getByRole("button", {
      name: /Closeable entry/,
    });
    await user.click(entryButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Close it
    await user.click(screen.getByLabelText("Close"));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
