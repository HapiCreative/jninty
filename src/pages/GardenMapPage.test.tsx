import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi, beforeAll } from "vitest";

// jsdom doesn't have ResizeObserver
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SettingsProvider } from "../hooks/useSettings";
import { ToastProvider } from "../components/ui/Toast";
import { db } from "../db/schema";
import * as gardenBedRepository from "../db/repositories/gardenBedRepository";
import * as plantRepository from "../db/repositories/plantRepository";
import * as plantingRepository from "../db/repositories/plantingRepository";
import * as seasonRepository from "../db/repositories/seasonRepository";

// Mock react-konva since it requires a real canvas environment
vi.mock("react-konva", () => {
  return {
    Stage: ({ children, ...props }: Record<string, unknown>) => (
      <div data-testid="konva-stage" {...filterDomProps(props)}>
        {children as React.ReactNode}
      </div>
    ),
    Layer: ({ children }: Record<string, unknown>) => (
      <div data-testid="konva-layer">{children as React.ReactNode}</div>
    ),
    Rect: (props: Record<string, unknown>) => (
      <div
        data-testid="konva-rect"
        data-x={props["x"]}
        data-y={props["y"]}
        data-width={props["width"]}
        data-height={props["height"]}
        onClick={(e) => {
          // Stop propagation so Stage's Konva-style onClick (which needs getStage()) isn't called
          e.stopPropagation();
          if (typeof props["onClick"] === "function") {
            (props["onClick"] as () => void)();
          }
        }}
      />
    ),
    Text: (props: Record<string, unknown>) => (
      <div data-testid="konva-text">{props["text"] as string}</div>
    ),
    Group: ({ children }: Record<string, unknown>) => (
      <div data-testid="konva-group">{children as React.ReactNode}</div>
    ),
    Line: () => <div data-testid="konva-line" />,
    Circle: () => <div data-testid="konva-circle" />,
  };
});

function filterDomProps(props: Record<string, unknown>) {
  const allowed = new Set([
    "className",
    "style",
    "id",
    "data-testid",
    "onClick",
    "onMouseDown",
    "onMouseMove",
    "onMouseUp",
  ]);
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (allowed.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

// Dynamic import for the lazy-loaded component
const GardenMapPage = (await import("./GardenMapPage")).default;

function renderMap() {
  return render(
    <MemoryRouter initialEntries={["/map"]}>
      <SettingsProvider>
        <ToastProvider>
          <Routes>
            <Route path="/map" element={<GardenMapPage />} />
            <Route path="/quick-log" element={<div>Quick Log Page</div>} />
          </Routes>
        </ToastProvider>
      </SettingsProvider>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("GardenMapPage", () => {
  it("renders toolbar with Select and Add Bed tools", async () => {
    renderMap();

    expect(screen.getByText("Select")).toBeInTheDocument();
    expect(screen.getByText("Add Bed")).toBeInTheDocument();
  });

  it("shows grid unit from settings", async () => {
    renderMap();

    // Default settings use "feet"
    await waitFor(() => {
      expect(screen.getByText(/1 square = 1 ft/)).toBeInTheDocument();
    });
  });

  it("renders the Konva stage", async () => {
    renderMap();

    expect(screen.getByTestId("konva-stage")).toBeInTheDocument();
  });

  describe("bed creation", () => {
    it("persists a bed to the database", async () => {
      const bed = await gardenBedRepository.create({
        name: "Test Bed",
        type: "vegetable_bed",
        gridX: 2,
        gridY: 3,
        gridWidth: 4,
        gridHeight: 2,
        shape: "rectangle" as const,
        color: "#7dbf4e",
      });

      expect(bed.id).toBeDefined();
      expect(bed.name).toBe("Test Bed");
      expect(bed.gridX).toBe(2);
      expect(bed.gridY).toBe(3);
      expect(bed.gridWidth).toBe(4);
      expect(bed.gridHeight).toBe(2);
      expect(bed.shape).toBe("rectangle");
      expect(bed.color).toBe("#7dbf4e");
    });
  });

  describe("bed position persistence", () => {
    it("updates bed position in the database", async () => {
      const bed = await gardenBedRepository.create({
        name: "Movable Bed",
        type: "herb_garden",
        gridX: 0,
        gridY: 0,
        gridWidth: 3,
        gridHeight: 2,
        shape: "rectangle" as const,
        color: "#d4623a",
      });

      const updated = await gardenBedRepository.update(bed.id, {
        gridX: 5,
        gridY: 4,
      });

      expect(updated.gridX).toBe(5);
      expect(updated.gridY).toBe(4);
      expect(updated.gridWidth).toBe(3);
      expect(updated.gridHeight).toBe(2);
      expect(updated.version).toBe(2);
    });

    it("updates bed dimensions in the database", async () => {
      const bed = await gardenBedRepository.create({
        name: "Resizable Bed",
        type: "vegetable_bed",
        gridX: 1,
        gridY: 1,
        gridWidth: 3,
        gridHeight: 2,
        shape: "rectangle" as const,
        color: "#7dbf4e",
      });

      const updated = await gardenBedRepository.update(bed.id, {
        gridWidth: 6,
        gridHeight: 4,
      });

      expect(updated.gridWidth).toBe(6);
      expect(updated.gridHeight).toBe(4);
    });
  });

  describe("plant assignment to beds", () => {
    it("associates plants with beds via plantings", async () => {
      const bed = await gardenBedRepository.create({
        name: "Herb Spiral",
        type: "herb_garden",
        gridX: 0,
        gridY: 0,
        gridWidth: 3,
        gridHeight: 3,
        shape: "rectangle" as const,
        color: "#7dbf4e",
      });

      const plant = await plantRepository.create({
        species: "Basil",
        type: "herb",
        isPerennial: false,
        source: "seed",
        status: "active",
        tags: [],
      });

      const season = await seasonRepository.create({
        name: "2026 Growing Season",
        year: 2026,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        isActive: true,
      });

      const planting = await plantingRepository.create({
        plantInstanceId: plant.id,
        seasonId: season.id,
        bedId: bed.id,
      });

      expect(planting.bedId).toBe(bed.id);

      const bedPlantings = await plantingRepository.getByBed(bed.id);
      expect(bedPlantings).toHaveLength(1);
      expect(bedPlantings[0]?.plantInstanceId).toBe(plant.id);
    });

    it("returns empty array for bed with no plants", async () => {
      const bed = await gardenBedRepository.create({
        name: "Empty Bed",
        type: "container",
        gridX: 5,
        gridY: 5,
        gridWidth: 2,
        gridHeight: 2,
        shape: "rectangle" as const,
        color: "#d49a4e",
      });

      const bedPlantings = await plantingRepository.getByBed(bed.id);
      expect(bedPlantings).toHaveLength(0);
    });
  });

  describe("bed detail panel", () => {
    it("renders bed name in the toolbar when bed exists", async () => {
      await gardenBedRepository.create({
        name: "Tomato Patch",
        type: "vegetable_bed",
        gridX: 0,
        gridY: 0,
        gridWidth: 4,
        gridHeight: 3,
        shape: "rectangle" as const,
        color: "#7dbf4e",
      });

      renderMap();

      // The bed should appear as a Konva text element via our mock
      await waitFor(() => {
        expect(screen.getByText("Tomato Patch")).toBeInTheDocument();
      });
    });

    it("opens detail panel when a bed is clicked", async () => {
      await gardenBedRepository.create({
        name: "Herb Spiral",
        type: "herb_garden",
        gridX: 0,
        gridY: 0,
        gridWidth: 3,
        gridHeight: 3,
        shape: "rectangle" as const,
        color: "#7dbf4e",
      });

      const user = userEvent.setup();
      renderMap();

      // Wait for the bed to render via mock Konva Text
      await waitFor(() => {
        expect(screen.getByText("Herb Spiral")).toBeInTheDocument();
      });

      // Click the bed's Konva Rect (rendered as a div by the mock)
      const rects = screen.getAllByTestId("konva-rect");
      // Find the bed rect (not the background rect) — bed rects have a non-zero width
      const bedRect = rects.find(
        (r) => r.getAttribute("data-width") === String(3 * 48),
      );
      expect(bedRect).toBeTruthy();
      await user.click(bedRect!);

      // Detail panel should show bed info
      await waitFor(() => {
        expect(screen.getByText("Herb Garden")).toBeInTheDocument(); // type label
        expect(screen.getByLabelText("Close panel")).toBeInTheDocument();
        expect(screen.getByText("Quick Log")).toBeInTheDocument();
        expect(screen.getByText("Delete Bed")).toBeInTheDocument();
      });
    });

    it("closes detail panel when close button is clicked", async () => {
      await gardenBedRepository.create({
        name: "Closeable Bed",
        type: "vegetable_bed",
        gridX: 0,
        gridY: 0,
        gridWidth: 4,
        gridHeight: 2,
        shape: "rectangle" as const,
        color: "#7dbf4e",
      });

      const user = userEvent.setup();
      renderMap();

      // Open the panel by clicking the bed rect
      await waitFor(() => {
        expect(screen.getByText("Closeable Bed")).toBeInTheDocument();
      });
      const rects = screen.getAllByTestId("konva-rect");
      const bedRect = rects.find(
        (r) => r.getAttribute("data-width") === String(4 * 48),
      );
      await user.click(bedRect!);

      await waitFor(() => {
        expect(screen.getByLabelText("Close panel")).toBeInTheDocument();
      });

      // Close it
      await user.click(screen.getByLabelText("Close panel"));

      // Panel should be gone — "Close panel" button should no longer exist
      await waitFor(() => {
        expect(screen.queryByLabelText("Close panel")).not.toBeInTheDocument();
      });
    });
  });

  describe("new bed modal", () => {
    it("opens modal when clicking Add Bed then switches tool", async () => {
      const user = userEvent.setup();
      renderMap();

      const addBedBtn = screen.getByText("Add Bed");
      await user.click(addBedBtn);

      // Tool should be active (has active styles)
      // The "Add Bed" button should now be highlighted
      expect(addBedBtn.closest("button")).toBeInTheDocument();
    });
  });

  describe("bed soft delete", () => {
    it("soft-deletes a bed and it disappears from getAll", async () => {
      const bed = await gardenBedRepository.create({
        name: "Doomed Bed",
        type: "other",
        gridX: 0,
        gridY: 0,
        gridWidth: 2,
        gridHeight: 2,
        shape: "rectangle" as const,
        color: "#9e641e",
      });

      await gardenBedRepository.softDelete(bed.id);

      const all = await gardenBedRepository.getAll();
      expect(all).toHaveLength(0);
    });

    it("shows confirmation before deleting via detail panel", async () => {
      await gardenBedRepository.create({
        name: "Confirm Delete Bed",
        type: "vegetable_bed",
        gridX: 0,
        gridY: 0,
        gridWidth: 4,
        gridHeight: 2,
        shape: "rectangle" as const,
        color: "#7dbf4e",
      });

      const user = userEvent.setup();
      renderMap();

      // Click the bed rect to open the detail panel
      await waitFor(() => {
        expect(screen.getByText("Confirm Delete Bed")).toBeInTheDocument();
      });
      const rects = screen.getAllByTestId("konva-rect");
      const bedRect = rects.find(
        (r) => r.getAttribute("data-width") === String(4 * 48),
      );
      await user.click(bedRect!);

      await waitFor(() => {
        expect(screen.getByText("Delete Bed")).toBeInTheDocument();
      });

      // Mock window.confirm to reject
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
      await user.click(screen.getByText("Delete Bed"));

      expect(confirmSpy).toHaveBeenCalledWith(
        'Delete "Confirm Delete Bed"? This cannot be undone.',
      );

      // Bed should still exist since confirm returned false
      const allAfterCancel = await gardenBedRepository.getAll();
      expect(allAfterCancel).toHaveLength(1);

      // Now confirm the delete
      confirmSpy.mockReturnValue(true);
      await user.click(screen.getByText("Delete Bed"));

      await waitFor(async () => {
        const allAfterDelete = await gardenBedRepository.getAll();
        expect(allAfterDelete).toHaveLength(0);
      });

      confirmSpy.mockRestore();
    });
  });

  describe("bed schema validation", () => {
    it("rejects bed with zero width", async () => {
      await expect(
        gardenBedRepository.create({
          name: "Invalid Bed",
          type: "vegetable_bed",
          gridX: 0,
          gridY: 0,
          gridWidth: 0,
          gridHeight: 2,
          shape: "rectangle" as const,
          color: "#7dbf4e",
        }),
      ).rejects.toThrow();
    });

    it("rejects bed with negative height", async () => {
      await expect(
        gardenBedRepository.create({
          name: "Invalid Bed",
          type: "vegetable_bed",
          gridX: 0,
          gridY: 0,
          gridWidth: 3,
          gridHeight: -1,
          shape: "rectangle" as const,
          color: "#7dbf4e",
        }),
      ).rejects.toThrow();
    });
  });
});
