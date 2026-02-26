import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { Stage, Layer, Rect, Text, Group, Line, Circle } from "react-konva";
import type Konva from "konva";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import * as gardenBedRepository from "../db/repositories/gardenBedRepository";
import * as plantingRepository from "../db/repositories/plantingRepository";
import * as plantRepository from "../db/repositories/plantRepository";
import type {
  GardenBed,
  BedType,
  BedSunExposure,
} from "../validation/gardenBed.schema.ts";
import type { Planting } from "../validation/planting.schema.ts";
import type {
  PlantInstance,
  PlantType,
} from "../validation/plantInstance.schema.ts";
import { useSettings } from "../hooks/useSettings";
import { useActiveSeason } from "../hooks/useActiveSeason";
import Button from "../components/ui/Button";

// ── Constants ──

const CELL_SIZE = 48; // px per grid unit
const GRID_COLOR = "#e5ddd0";
const GRID_COLS = 30;
const GRID_ROWS = 20;

const BED_COLORS = [
  "#7dbf4e", // green
  "#d4623a", // terracotta
  "#b87a2a", // brown
  "#5da02e", // dark green
  "#e8825a", // light terracotta
  "#9e641e", // dark brown
  "#a3d67a", // light green
  "#d49a4e", // golden
];

const BED_TYPE_LABELS: Record<BedType, string> = {
  vegetable_bed: "Vegetable Bed",
  flower_bed: "Flower Bed",
  fruit_area: "Fruit Area",
  herb_garden: "Herb Garden",
  container: "Container",
  other: "Other",
};

const SUN_LABELS: Record<BedSunExposure, string> = {
  full_sun: "Full Sun",
  partial_shade: "Partial Shade",
  full_shade: "Full Shade",
};

const PLANT_TOKEN_COLORS: Record<PlantType, string> = {
  vegetable: "#5da02e",
  herb: "#7dbf4e",
  flower: "#d4623a",
  ornamental: "#b87a2a",
  fruit_tree: "#9e641e",
  berry: "#e8825a",
  other: "#634120",
};

const MAX_VISIBLE_TOKENS = 50;

// ── Tool types ──

type Tool = "select" | "draw";

interface DrawRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// ── Helpers ──

function snapToGrid(value: number): number {
  return Math.round(value / CELL_SIZE);
}

function gridToPx(gridUnits: number): number {
  return gridUnits * CELL_SIZE;
}

// ── Grid background component ──

function GridLines({ cols, rows }: { cols: number; rows: number }) {
  const lines: React.JSX.Element[] = [];
  const width = cols * CELL_SIZE;
  const height = rows * CELL_SIZE;

  for (let x = 0; x <= cols; x++) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x * CELL_SIZE, 0, x * CELL_SIZE, height]}
        stroke={GRID_COLOR}
        strokeWidth={x % 5 === 0 ? 1 : 0.5}
      />,
    );
  }

  for (let y = 0; y <= rows; y++) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, y * CELL_SIZE, width, y * CELL_SIZE]}
        stroke={GRID_COLOR}
        strokeWidth={y % 5 === 0 ? 1 : 0.5}
      />,
    );
  }

  return <>{lines}</>;
}

// ── Plant tokens on a bed ──

function PlantTokens({
  bed,
  plantings,
  plants,
}: {
  bed: GardenBed;
  plantings: Planting[];
  plants: Map<string, PlantInstance>;
}) {
  const bedPx = {
    x: gridToPx(bed.gridX),
    y: gridToPx(bed.gridY),
    width: gridToPx(bed.gridWidth),
    height: gridToPx(bed.gridHeight),
  };

  const bedPlantings = plantings.filter((p) => p.bedId === bed.id);
  const visibleCount = Math.min(bedPlantings.length, MAX_VISIBLE_TOKENS);
  const overflow = bedPlantings.length - visibleCount;

  const tokenRadius = 6;
  const tokensPerRow = Math.max(
    1,
    Math.floor((bedPx.width - 8) / (tokenRadius * 2 + 4)),
  );

  return (
    <Group>
      {bedPlantings.slice(0, visibleCount).map((planting, i) => {
        const plant = plants.get(planting.plantInstanceId);
        const col = i % tokensPerRow;
        const row = Math.floor(i / tokensPerRow);
        const cx = bedPx.x + 10 + col * (tokenRadius * 2 + 4);
        const cy = bedPx.y + bedPx.height - 10 - row * (tokenRadius * 2 + 4);
        const color = plant
          ? PLANT_TOKEN_COLORS[plant.type] ?? PLANT_TOKEN_COLORS["other"]!
          : PLANT_TOKEN_COLORS["other"]!;

        return (
          <Circle
            key={planting.id}
            x={cx}
            y={cy}
            radius={tokenRadius}
            fill={color}
            stroke="#fff"
            strokeWidth={1.5}
            listening={false}
          />
        );
      })}
      {overflow > 0 && (
        <Text
          x={bedPx.x + bedPx.width - 30}
          y={bedPx.y + bedPx.height - 16}
          text={`+${overflow}`}
          fontSize={10}
          fill="#fff"
          fontStyle="bold"
          listening={false}
        />
      )}
    </Group>
  );
}

// ── Bed detail sidebar ──

function BedDetailPanel({
  bed,
  plantings,
  plants,
  unit,
  hasActiveSeason,
  onClose,
  onDelete,
  onQuickLog,
  onAssignPlant,
  onRemovePlant,
}: {
  bed: GardenBed;
  plantings: Planting[];
  plants: Map<string, PlantInstance>;
  unit: string;
  hasActiveSeason: boolean;
  onClose: () => void;
  onDelete: () => void;
  onQuickLog: () => void;
  onAssignPlant: () => void;
  onRemovePlant: (plantingId: string) => void;
}) {
  const bedPlantings = plantings.filter((p) => p.bedId === bed.id);

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-72 flex-col border-l border-cream-200 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3">
        <h3 className="font-display text-lg font-bold text-green-800">
          {bed.name}
        </h3>
        <button
          onClick={onClose}
          className="rounded p-1 text-soil-400 hover:bg-cream-100 hover:text-soil-700"
          aria-label="Close panel"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-medium text-soil-600">Type</dt>
            <dd className="text-soil-900">
              {BED_TYPE_LABELS[bed.type] ?? bed.type}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-soil-600">Size</dt>
            <dd className="text-soil-900">
              {bed.gridWidth} x {bed.gridHeight} {unit}
            </dd>
          </div>
          {bed.sunExposure && (
            <div>
              <dt className="font-medium text-soil-600">Sun Exposure</dt>
              <dd className="text-soil-900">
                {SUN_LABELS[bed.sunExposure] ?? bed.sunExposure}
              </dd>
            </div>
          )}
          {bed.notes && (
            <div>
              <dt className="font-medium text-soil-600">Notes</dt>
              <dd className="text-soil-900">{bed.notes}</dd>
            </div>
          )}
        </dl>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium text-soil-600">
              Plants ({bedPlantings.length})
            </h4>
            {hasActiveSeason && (
              <button
                onClick={onAssignPlant}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Assign Plant
              </button>
            )}
          </div>
          {!hasActiveSeason && (
            <p className="mb-2 text-xs text-terracotta-500">
              Create an active season in Settings to assign plants.
            </p>
          )}
          {bedPlantings.length === 0 ? (
            <p className="text-sm text-soil-400">No plants assigned yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {bedPlantings.map((planting) => {
                const plant = plants.get(planting.plantInstanceId);
                return (
                  <li
                    key={planting.id}
                    className="group flex items-center gap-2 rounded-md bg-cream-50 px-2.5 py-1.5 text-sm"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{
                        backgroundColor: plant
                          ? PLANT_TOKEN_COLORS[plant.type] ??
                            PLANT_TOKEN_COLORS["other"]
                          : PLANT_TOKEN_COLORS["other"],
                      }}
                    />
                    <span className="flex-1 text-soil-900">
                      {plant?.nickname ?? plant?.species ?? "Unknown plant"}
                    </span>
                    <button
                      onClick={() => onRemovePlant(planting.id)}
                      className="rounded p-0.5 text-soil-300 opacity-0 transition-opacity hover:text-terracotta-500 group-hover:opacity-100"
                      aria-label={`Remove ${plant?.nickname ?? plant?.species ?? "plant"} from bed`}
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-cream-200 p-4">
        <Button onClick={onQuickLog} className="w-full">
          Quick Log
        </Button>
        <Button variant="ghost" onClick={onDelete} className="w-full text-terracotta-500 hover:text-terracotta-600 hover:bg-terracotta-500/10">
          Delete Bed
        </Button>
      </div>
    </div>
  );
}

// ── New bed form modal ──

function NewBedModal({
  onSave,
  onCancel,
}: {
  onSave: (data: {
    name: string;
    type: BedType;
    color: string;
    sunExposure?: BedSunExposure;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<BedType>("vegetable_bed");
  const [color, setColor] = useState(BED_COLORS[0]!);
  const [sunExposure, setSunExposure] = useState<BedSunExposure | "">("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const data: {
      name: string;
      type: BedType;
      color: string;
      sunExposure?: BedSunExposure;
    } = { name: name.trim(), type, color };
    if (sunExposure) {
      data.sunExposure = sunExposure;
    }
    onSave(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
      >
        <h3 className="mb-4 font-display text-lg font-bold text-green-800">
          New Garden Bed
        </h3>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-soil-700">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-cream-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            placeholder="e.g. Raised Bed #1"
            autoFocus
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-soil-700">
            Type
          </span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as BedType)}
            className="w-full rounded-lg border border-cream-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          >
            {Object.entries(BED_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-soil-700">
            Sun Exposure
          </span>
          <select
            value={sunExposure}
            onChange={(e) =>
              setSunExposure(e.target.value as BedSunExposure | "")
            }
            className="w-full rounded-lg border border-cream-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          >
            <option value="">Not specified</option>
            {Object.entries(SUN_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="mb-4">
          <legend className="mb-1.5 text-sm font-medium text-soil-700">
            Color
          </legend>
          <div className="flex flex-wrap gap-2">
            {BED_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full border-2 transition-transform ${
                  color === c
                    ? "scale-110 border-green-800"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </fieldset>

        <div className="flex gap-2">
          <Button type="submit" disabled={!name.trim()} className="flex-1">
            Create Bed
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Assign plant to bed modal ──

function AssignPlantModal({
  bed,
  plantings,
  plants,
  onAssign,
  onClose,
}: {
  bed: GardenBed;
  plantings: Planting[];
  plants: PlantInstance[];
  onAssign: (plantInstanceId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const bedPlantIds = new Set(
    plantings.filter((p) => p.bedId === bed.id).map((p) => p.plantInstanceId),
  );

  const availablePlants = plants
    .filter((p) => !bedPlantIds.has(p.id) && p.status === "active")
    .filter((p) => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        p.nickname?.toLowerCase().includes(term) ||
        p.species.toLowerCase().includes(term) ||
        p.variety?.toLowerCase().includes(term)
      );
    });

  const totalActive = plants.filter((p) => p.status === "active").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[70vh] w-full max-w-sm flex-col rounded-xl bg-white shadow-xl">
        <div className="p-5 pb-3">
          <h3 className="mb-3 font-display text-lg font-bold text-green-800">
            Assign Plant to {bed.name}
          </h3>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-cream-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            placeholder="Search plants..."
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {availablePlants.length === 0 ? (
            <p className="py-4 text-center text-sm text-soil-400">
              {totalActive === 0
                ? "No plants in your inventory yet. Add plants first."
                : "All active plants are already assigned to this bed."}
            </p>
          ) : (
            <ul className="space-y-1">
              {availablePlants.map((plant) => (
                <li key={plant.id}>
                  <button
                    onClick={() => onAssign(plant.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-cream-100"
                  >
                    <span
                      className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          PLANT_TOKEN_COLORS[plant.type] ??
                          PLANT_TOKEN_COLORS["other"],
                      }}
                    />
                    <span className="font-medium text-soil-900">
                      {plant.nickname ?? plant.species}
                    </span>
                    {plant.variety && (
                      <span className="text-xs text-soil-400">
                        ({plant.variety})
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-cream-200 p-4">
          <Button variant="secondary" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main GardenMapPage ──

export default function GardenMapPage() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Canvas dimensions
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  // Tool state
  const [tool, setTool] = useState<Tool>("select");
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [drawRect, setDrawRect] = useState<DrawRect | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showNewBedModal, setShowNewBedModal] = useState(false);
  const [showAssignPlant, setShowAssignPlant] = useState(false);
  const [pendingDraw, setPendingDraw] = useState<{
    gridX: number;
    gridY: number;
    gridWidth: number;
    gridHeight: number;
  } | null>(null);

  // Refs for drawing — avoids stale closure in mouseUp when mouseDown
  // state hasn't been committed yet (React batches updates)
  const isDrawingRef = useRef(false);
  const drawRectRef = useRef<DrawRect | null>(null);

  // Data
  const emptyBeds: GardenBed[] = useMemo(() => [], []);
  const emptyPlantings: Planting[] = useMemo(() => [], []);
  const emptyPlants: PlantInstance[] = useMemo(() => [], []);

  const beds = useLiveQuery(() => gardenBedRepository.getAll()) ?? emptyBeds;
  const allPlantings =
    useLiveQuery(() => plantingRepository.getAll()) ?? emptyPlantings;
  const rawPlants =
    useLiveQuery(() => plantRepository.getAll()) ?? emptyPlants;

  const activeSeason = useActiveSeason();

  const plantsMap = useMemo(() => {
    const map = new Map<string, PlantInstance>();
    for (const plant of rawPlants) {
      map.set(plant.id, plant);
    }
    return map;
  }, [rawPlants]);

  const selectedBed = beds.find((b) => b.id === selectedBedId);

  // Resize handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setStageSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    // Set initial size
    setStageSize({
      width: container.clientWidth,
      height: container.clientHeight,
    });

    return () => observer.disconnect();
  }, []);

  // ── Drawing handlers ──

  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (tool !== "draw") return;

      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const rect: DrawRect = {
        startX: pos.x,
        startY: pos.y,
        endX: pos.x,
        endY: pos.y,
      };
      isDrawingRef.current = true;
      drawRectRef.current = rect;
      setIsDrawing(true);
      setDrawRect(rect);
    },
    [tool],
  );

  const handleStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!isDrawingRef.current || !drawRectRef.current) return;

      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const updated = { ...drawRectRef.current, endX: pos.x, endY: pos.y };
      drawRectRef.current = updated;
      setDrawRect(updated);
    },
    [],
  );

  const handleStageMouseUp = useCallback(() => {
    if (!isDrawingRef.current || !drawRectRef.current) {
      isDrawingRef.current = false;
      drawRectRef.current = null;
      setIsDrawing(false);
      setDrawRect(null);
      return;
    }

    const dr = drawRectRef.current;
    isDrawingRef.current = false;
    drawRectRef.current = null;
    setIsDrawing(false);
    setDrawRect(null);

    const gx = snapToGrid(Math.min(dr.startX, dr.endX));
    const gy = snapToGrid(Math.min(dr.startY, dr.endY));
    const gw = Math.max(
      1,
      snapToGrid(Math.abs(dr.endX - dr.startX)),
    );
    const gh = Math.max(
      1,
      snapToGrid(Math.abs(dr.endY - dr.startY)),
    );

    if (gw >= 1 && gh >= 1) {
      setPendingDraw({ gridX: gx, gridY: gy, gridWidth: gw, gridHeight: gh });
      setShowNewBedModal(true);
    }
  }, []);

  // ── Bed interaction handlers ──

  const handleBedClick = useCallback(
    (bedId: string) => {
      if (tool === "select") {
        setSelectedBedId((prev) => (prev === bedId ? null : bedId));
      }
    },
    [tool],
  );

  const handleBedDragEnd = useCallback(
    async (bedId: string, gridX: number, gridY: number) => {
      await gardenBedRepository.update(bedId, { gridX, gridY });
    },
    [],
  );

  const handleCreateBed = useCallback(
    async (data: {
      name: string;
      type: BedType;
      color: string;
      sunExposure?: BedSunExposure;
    }) => {
      if (!pendingDraw) return;

      await gardenBedRepository.create({
        name: data.name,
        type: data.type,
        color: data.color,
        gridX: pendingDraw.gridX,
        gridY: pendingDraw.gridY,
        gridWidth: pendingDraw.gridWidth,
        gridHeight: pendingDraw.gridHeight,
        shape: "rectangle" as const,
        sunExposure: data.sunExposure,
      });

      setPendingDraw(null);
      setShowNewBedModal(false);
      setTool("select");
    },
    [pendingDraw],
  );

  const handleDeleteBed = useCallback(async () => {
    if (!selectedBedId) return;
    const bed = beds.find((b) => b.id === selectedBedId);
    const name = bed?.name ?? "this bed";
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await gardenBedRepository.softDelete(selectedBedId);
    setSelectedBedId(null);
  }, [selectedBedId, beds]);

  // ── Assign / remove plant from bed ──

  const handleAssignPlant = useCallback(
    async (plantInstanceId: string) => {
      if (!selectedBedId || !activeSeason) return;
      await plantingRepository.create({
        plantInstanceId,
        seasonId: activeSeason.id,
        bedId: selectedBedId,
      });
      setShowAssignPlant(false);
    },
    [selectedBedId, activeSeason],
  );

  const handleRemovePlant = useCallback(async (plantingId: string) => {
    await plantingRepository.softDelete(plantingId);
  }, []);

  // ── Transformer / resize ──

  const handleTransformEnd = useCallback(
    async (bedId: string, node: Konva.Node) => {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      const bed = beds.find((b) => b.id === bedId);
      if (!bed) return;

      const newWidth = Math.max(1, snapToGrid(gridToPx(bed.gridWidth) * scaleX));
      const newHeight = Math.max(
        1,
        snapToGrid(gridToPx(bed.gridHeight) * scaleY),
      );
      const newX = snapToGrid(node.x());
      const newY = snapToGrid(node.y());

      // Reset scale and apply new grid dimensions
      node.scaleX(1);
      node.scaleY(1);
      node.x(gridToPx(newX));
      node.y(gridToPx(newY));

      await gardenBedRepository.update(bedId, {
        gridX: newX,
        gridY: newY,
        gridWidth: newWidth,
        gridHeight: newHeight,
      });
    },
    [beds],
  );

  // Stage cursor — set directly on Konva's container element so it isn't
  // overridden by the canvas element's inline styles.
  const stageCursor = tool === "draw" ? "crosshair" : "default";

  useEffect(() => {
    const container = stageRef.current?.container();
    if (container) {
      container.style.cursor = stageCursor;
    }
  }, [stageCursor]);

  return (
    <div className="flex h-full flex-col">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-cream-200 bg-white px-4 py-2">
        <div className="flex gap-1 rounded-lg bg-cream-100 p-0.5">
          <button
            onClick={() => {
              setTool("select");
              setSelectedBedId(null);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tool === "select"
                ? "bg-white text-green-800 shadow-sm"
                : "text-soil-600 hover:text-soil-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
              </svg>
              Select
            </span>
          </button>
          <button
            onClick={() => {
              setTool("draw");
              setSelectedBedId(null);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tool === "draw"
                ? "bg-white text-green-800 shadow-sm"
                : "text-soil-600 hover:text-soil-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
              Add Bed
            </span>
          </button>
        </div>

        <div className="h-5 w-px bg-cream-200" />

        <span className="text-xs text-soil-400">
          1 square = 1 {settings.gridUnit === "feet" ? "ft" : "m"}
        </span>

        {tool === "draw" && (
          <span className="text-xs font-medium text-green-700">
            Click and drag on the grid to draw a bed
          </span>
        )}

        {selectedBed && tool === "select" && (
          <>
            <div className="h-5 w-px bg-cream-200" />
            <span className="text-sm font-medium text-green-800">
              {selectedBed.name}
            </span>
          </>
        )}
      </div>

      {/* ── Canvas area ── */}
      <div className="relative flex-1 overflow-hidden bg-cream-50">
        <div
          ref={containerRef}
          className="h-full w-full"
          style={{
            cursor: stageCursor,
            userSelect: tool === "draw" ? "none" : undefined,
          }}
        >
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onTouchStart={handleStageMouseDown}
            onTouchMove={handleStageMouseMove}
            onTouchEnd={handleStageMouseUp}
            onClick={(e) => {
              // Deselect when clicking on empty canvas
              if (e.target === e.target.getStage()) {
                setSelectedBedId(null);
              }
            }}
          >
            <Layer>
              {/* Background */}
              <Rect
                x={0}
                y={0}
                width={GRID_COLS * CELL_SIZE}
                height={GRID_ROWS * CELL_SIZE}
                fill="#FDF6EC"
              />

              {/* Grid lines */}
              <GridLines cols={GRID_COLS} rows={GRID_ROWS} />

              {/* Garden beds */}
              {beds.map((bed) => {
                const isSelected = bed.id === selectedBedId;
                return (
                  <Group key={bed.id}>
                    <Rect
                      x={gridToPx(bed.gridX)}
                      y={gridToPx(bed.gridY)}
                      width={gridToPx(bed.gridWidth)}
                      height={gridToPx(bed.gridHeight)}
                      fill={bed.color}
                      opacity={0.7}
                      cornerRadius={4}
                      stroke={isSelected ? "#2D5016" : "#fff"}
                      strokeWidth={isSelected ? 3 : 1.5}
                      shadowColor={isSelected ? "#2D5016" : "transparent"}
                      shadowBlur={isSelected ? 8 : 0}
                      shadowOpacity={0.3}
                      draggable={tool === "select"}
                      onClick={() => handleBedClick(bed.id)}
                      onTap={() => handleBedClick(bed.id)}
                      onDragEnd={(e) => {
                        const node = e.target;
                        // Snap to grid after drag
                        const newGx = snapToGrid(node.x());
                        const newGy = snapToGrid(node.y());
                        node.x(gridToPx(newGx));
                        node.y(gridToPx(newGy));
                        void handleBedDragEnd(bed.id, newGx, newGy);
                      }}
                      onTransformEnd={(e) => {
                        void handleTransformEnd(bed.id, e.target);
                      }}
                    />
                    {/* Bed name label */}
                    <Text
                      x={gridToPx(bed.gridX) + 6}
                      y={gridToPx(bed.gridY) + 4}
                      width={gridToPx(bed.gridWidth) - 12}
                      text={bed.name}
                      fontSize={13}
                      fontFamily="Inter, sans-serif"
                      fill="#fff"
                      fontStyle="bold"
                      listening={false}
                      ellipsis
                      wrap="none"
                    />
                    {/* Plant tokens */}
                    <PlantTokens
                      bed={bed}
                      plantings={allPlantings}
                      plants={plantsMap}
                    />
                  </Group>
                );
              })}

              {/* Drawing preview rectangle */}
              {drawRect && isDrawing && (
                <Rect
                  x={Math.min(drawRect.startX, drawRect.endX)}
                  y={Math.min(drawRect.startY, drawRect.endY)}
                  width={Math.abs(drawRect.endX - drawRect.startX)}
                  height={Math.abs(drawRect.endY - drawRect.startY)}
                  fill="#7dbf4e"
                  opacity={0.3}
                  stroke="#2D5016"
                  strokeWidth={2}
                  dash={[6, 3]}
                  listening={false}
                />
              )}
            </Layer>
          </Stage>
        </div>

        {/* Bed detail sidebar */}
        {selectedBed && (
          <BedDetailPanel
            bed={selectedBed}
            plantings={allPlantings}
            plants={plantsMap}
            unit={settings.gridUnit === "feet" ? "ft" : "m"}
            hasActiveSeason={activeSeason != null}
            onClose={() => setSelectedBedId(null)}
            onDelete={() => void handleDeleteBed()}
            onQuickLog={() =>
              navigate(`/quick-log?bedId=${selectedBed.id}`)
            }
            onAssignPlant={() => setShowAssignPlant(true)}
            onRemovePlant={(id) => void handleRemovePlant(id)}
          />
        )}
      </div>

      {/* New bed modal */}
      {showNewBedModal && (
        <NewBedModal
          onSave={(data) => void handleCreateBed(data)}
          onCancel={() => {
            setShowNewBedModal(false);
            setPendingDraw(null);
          }}
        />
      )}

      {/* Assign plant modal */}
      {showAssignPlant && selectedBed && (
        <AssignPlantModal
          bed={selectedBed}
          plantings={allPlantings}
          plants={rawPlants}
          onAssign={(plantId) => void handleAssignPlant(plantId)}
          onClose={() => setShowAssignPlant(false)}
        />
      )}
    </div>
  );
}
