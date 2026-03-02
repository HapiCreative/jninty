import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { clearPouchDB } from "../db/pouchdb/testUtils.ts";
import { plantRepository } from "../db/index.ts";
import { _resetIndex } from "../db/search.ts";
import { SettingsProvider } from "../hooks/useSettings.tsx";
import PlantFormPage from "./PlantFormPage.tsx";

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
  await clearPouchDB();
  _resetIndex();
  vi.clearAllMocks();
});

function renderCreateForm() {
  return render(
    <SettingsProvider>
      <MemoryRouter initialEntries={["/plants/new"]}>
        <Routes>
          <Route path="plants/new" element={<PlantFormPage />} />
          <Route path="plants/:id" element={<div>Detail Page</div>} />
          <Route path="plants" element={<div>Plants List</div>} />
        </Routes>
      </MemoryRouter>
    </SettingsProvider>,
  );
}

function renderEditForm(id: string) {
  return render(
    <SettingsProvider>
      <MemoryRouter initialEntries={[`/plants/${id}/edit`]}>
        <Routes>
          <Route path="plants/:id/edit" element={<PlantFormPage />} />
          <Route path="plants/:id" element={<div>Detail Page</div>} />
          <Route path="plants" element={<div>Plants List</div>} />
        </Routes>
      </MemoryRouter>
    </SettingsProvider>,
  );
}

describe("PlantFormPage", () => {
  describe("create mode", () => {
    it("renders the create form with all fields", () => {
      renderCreateForm();

      expect(
        screen.getByRole("heading", { name: "Add Plant" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Species/)).toBeInTheDocument();
      expect(screen.getByLabelText("Nickname")).toBeInTheDocument();
      expect(screen.getByLabelText("Variety")).toBeInTheDocument();
      expect(screen.getByLabelText("Type")).toBeInTheDocument();
      expect(screen.getByLabelText("Perennial")).toBeInTheDocument();
      expect(screen.getByLabelText("Source")).toBeInTheDocument();
      expect(screen.getByLabelText("Status")).toBeInTheDocument();
      expect(screen.getByLabelText("Date Acquired")).toBeInTheDocument();
      expect(screen.getByLabelText("Tags")).toBeInTheDocument();
      expect(screen.getByLabelText("Care Notes")).toBeInTheDocument();
    });

    it("shows photo section with capture buttons", () => {
      renderCreateForm();

      expect(screen.getByText("Photo")).toBeInTheDocument();
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
      expect(screen.getByText("Choose Photo")).toBeInTheDocument();
      expect(screen.getByText("No photo added")).toBeInTheDocument();
    });

    it("shows validation error when species is empty", async () => {
      const user = userEvent.setup();
      renderCreateForm();

      await user.click(screen.getByRole("button", { name: "Add Plant" }));

      await waitFor(() => {
        expect(
          screen.getByText("Species is required."),
        ).toBeInTheDocument();
      });
    });

    it("creates a plant and navigates to detail page", async () => {
      const user = userEvent.setup();
      renderCreateForm();

      await user.type(screen.getByLabelText(/Species/), "Tomato");
      await user.selectOptions(screen.getByLabelText("Type"), "vegetable");
      await user.selectOptions(screen.getByLabelText("Source"), "seed");
      await user.click(screen.getByRole("button", { name: "Add Plant" }));

      // Should navigate to detail page
      await waitFor(() => {
        expect(screen.getByText("Detail Page")).toBeInTheDocument();
      });

      // Verify plant was created in DB
      const plants = await plantRepository.getAll();
      expect(plants).toHaveLength(1);
      expect(plants[0]?.species).toBe("Tomato");
      expect(plants[0]?.type).toBe("vegetable");
      expect(plants[0]?.source).toBe("seed");
    });

    it("saves optional fields when provided", async () => {
      const user = userEvent.setup();
      renderCreateForm();

      await user.type(screen.getByLabelText(/Species/), "Apple");
      await user.type(screen.getByLabelText("Nickname"), "Old Apple");
      await user.type(screen.getByLabelText("Variety"), "Honeycrisp");
      await user.type(screen.getByLabelText("Tags"), "orchard, heirloom");
      await user.type(
        screen.getByLabelText("Care Notes"),
        "Needs yearly pruning",
      );
      await user.selectOptions(screen.getByLabelText("Type"), "fruit_tree");
      await user.click(screen.getByLabelText("Perennial")); // toggle on

      await user.click(screen.getByRole("button", { name: "Add Plant" }));

      await waitFor(() => {
        expect(screen.getByText("Detail Page")).toBeInTheDocument();
      });

      const plants = await plantRepository.getAll();
      expect(plants[0]?.nickname).toBe("Old Apple");
      expect(plants[0]?.variety).toBe("Honeycrisp");
      expect(plants[0]?.tags).toEqual(["orchard", "heirloom"]);
      expect(plants[0]?.careNotes).toBe("Needs yearly pruning");
      expect(plants[0]?.isPerennial).toBe(true);
    });

    it("has a cancel button that navigates back", async () => {
      const user = userEvent.setup();
      renderCreateForm();

      await user.click(screen.getByText("Cancel"));

      await waitFor(() => {
        expect(screen.getByText("Plants List")).toBeInTheDocument();
      });
    });
  });

  describe("edit mode", () => {
    it("pre-fills all fields from existing plant", async () => {
      const plant = await plantRepository.create({
        species: "Basil",
        nickname: "Kitchen Basil",
        variety: "Genovese",
        type: "herb",
        isPerennial: false,
        source: "nursery",
        status: "active",
        tags: ["indoor", "culinary"],
        careNotes: "Keep moist",
      });

      renderEditForm(plant.id);

      await waitFor(() => {
        expect(screen.getByText("Edit Plant")).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/Species/)).toHaveValue("Basil");
      expect(screen.getByLabelText("Nickname")).toHaveValue("Kitchen Basil");
      expect(screen.getByLabelText("Variety")).toHaveValue("Genovese");
      expect(screen.getByLabelText("Type")).toHaveValue("herb");
      expect(screen.getByLabelText("Source")).toHaveValue("nursery");
      expect(screen.getByLabelText("Status")).toHaveValue("active");
      expect(screen.getByLabelText("Tags")).toHaveValue("indoor, culinary");
      expect(screen.getByLabelText("Care Notes")).toHaveValue("Keep moist");
    });

    it("saves changes and navigates to detail page", async () => {
      const plant = await plantRepository.create({
        species: "Basil",
        type: "herb",
        isPerennial: false,
        source: "nursery",
        status: "active",
        tags: [],
      });

      const user = userEvent.setup();
      renderEditForm(plant.id);

      await waitFor(() => {
        expect(screen.getByText("Edit Plant")).toBeInTheDocument();
      });

      await user.clear(screen.getByLabelText(/Species/));
      await user.type(screen.getByLabelText(/Species/), "Sweet Basil");
      await user.click(screen.getByText("Save Changes"));

      await waitFor(() => {
        expect(screen.getByText("Detail Page")).toBeInTheDocument();
      });

      const updated = await plantRepository.getById(plant.id);
      expect(updated?.species).toBe("Sweet Basil");
    });

    it("redirects to plants list if plant not found", async () => {
      renderEditForm("non-existent-id");

      await waitFor(() => {
        expect(screen.getByText("Plants List")).toBeInTheDocument();
      });
    });
  });
});
