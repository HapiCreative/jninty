import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import { format, parseISO } from "date-fns";
import { seasonRepository, plantingRepository, plantRepository, journalRepository } from "../db/index.ts";
import type { Planting } from "../validation/planting.schema";
import type { JournalEntry } from "../validation/journalEntry.schema";
import type { PlantInstance } from "../validation/plantInstance.schema";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Skeleton from "../components/ui/Skeleton";
import { ChevronLeftIcon } from "../components/icons";

const selectClass =
  "w-full rounded-lg border border-brown-200 bg-cream-50 px-3 py-2 text-sm text-soil-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/25";

const outcomeVariant: Record<
  string,
  "success" | "warning" | "danger" | "default"
> = {
  thrived: "success",
  ok: "warning",
  failed: "danger",
  unknown: "default",
};

const outcomeLabel: Record<string, string> = {
  thrived: "Thrived",
  ok: "OK",
  failed: "Failed",
  unknown: "Unknown",
};

// ─── Types ───

interface PlantComparison {
  plantId: string;
  plant: PlantInstance;
  plantingA: Planting;
  plantingB: Planting;
  journalCountA: number;
  journalCountB: number;
  harvestWeightA: number;
  harvestWeightB: number;
}

interface SeasonStats {
  totalPlants: number;
  thrived: number;
  ok: number;
  failed: number;
  unknown: number;
  successRate: number;
  totalHarvestWeight: number;
}

function computeSeasonStats(
  plantings: Planting[],
  entries: JournalEntry[],
): SeasonStats {
  const totalPlants = plantings.length;
  let thrived = 0;
  let ok = 0;
  let failed = 0;
  let unknown = 0;

  for (const p of plantings) {
    switch (p.outcome) {
      case "thrived":
        thrived++;
        break;
      case "ok":
        ok++;
        break;
      case "failed":
        failed++;
        break;
      default:
        unknown++;
    }
  }

  const successRate = totalPlants > 0 ? (thrived + ok) / totalPlants : 0;

  let totalHarvestWeight = 0;
  for (const e of entries) {
    if (e.activityType === "harvest" && e.harvestWeight != null) {
      totalHarvestWeight += e.harvestWeight;
    }
  }

  return { totalPlants, thrived, ok, failed, unknown, successRate, totalHarvestWeight };
}

function formatWeight(grams: number): string {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(1)} kg`;
  }
  return `${String(Math.round(grams))} g`;
}

// ─── Component ───

export default function SeasonComparisonPage() {
  const [seasonIdA, setSeasonIdA] = useState("");
  const [seasonIdB, setSeasonIdB] = useState("");

  const seasons = usePouchQuery(() => seasonRepository.getAll(), []);
  const allPlants = usePouchQuery(() => plantRepository.getAll(), []);

  const plantingsA = usePouchQuery(
    () =>
      seasonIdA
        ? plantingRepository.getBySeason(seasonIdA)
        : Promise.resolve([]),
    [seasonIdA],
  );

  const plantingsB = usePouchQuery(
    () =>
      seasonIdB
        ? plantingRepository.getBySeason(seasonIdB)
        : Promise.resolve([]),
    [seasonIdB],
  );

  const entriesA = usePouchQuery(
    () =>
      seasonIdA
        ? journalRepository.getBySeasonId(seasonIdA)
        : Promise.resolve([]),
    [seasonIdA],
  );

  const entriesB = usePouchQuery(
    () =>
      seasonIdB
        ? journalRepository.getBySeasonId(seasonIdB)
        : Promise.resolve([]),
    [seasonIdB],
  );

  // Build plant lookup
  const plantMap = useMemo(() => {
    const map = new Map<string, PlantInstance>();
    if (!allPlants) return map;
    for (const p of allPlants) map.set(p.id, p);
    return map;
  }, [allPlants]);

  // Build comparison data
  const { comparisons, statsA, statsB, whatWorked, whatToChange } = useMemo(() => {
    if (!plantingsA || !plantingsB || !entriesA || !entriesB) {
      return {
        comparisons: [] as PlantComparison[],
        statsA: null as SeasonStats | null,
        statsB: null as SeasonStats | null,
        whatWorked: [] as PlantComparison[],
        whatToChange: [] as PlantComparison[],
      };
    }

    const statsA = computeSeasonStats(plantingsA, entriesA);
    const statsB = computeSeasonStats(plantingsB, entriesB);

    // Group journal entries by plantInstanceId for each season
    const entriesByPlantA = new Map<string, JournalEntry[]>();
    for (const e of entriesA) {
      if (e.plantInstanceId) {
        const arr = entriesByPlantA.get(e.plantInstanceId) ?? [];
        arr.push(e);
        entriesByPlantA.set(e.plantInstanceId, arr);
      }
    }

    const entriesByPlantB = new Map<string, JournalEntry[]>();
    for (const e of entriesB) {
      if (e.plantInstanceId) {
        const arr = entriesByPlantB.get(e.plantInstanceId) ?? [];
        arr.push(e);
        entriesByPlantB.set(e.plantInstanceId, arr);
      }
    }

    // Build planting maps by plantInstanceId
    const plantingMapA = new Map<string, Planting>();
    for (const p of plantingsA) plantingMapA.set(p.plantInstanceId, p);

    const plantingMapB = new Map<string, Planting>();
    for (const p of plantingsB) plantingMapB.set(p.plantInstanceId, p);

    // Find overlapping plants
    const comparisons: PlantComparison[] = [];
    for (const [plantId, plantingA] of plantingMapA) {
      const plantingB = plantingMapB.get(plantId);
      if (!plantingB) continue;

      const plant = plantMap.get(plantId);
      if (!plant) continue;

      const plantEntriesA = entriesByPlantA.get(plantId) ?? [];
      const plantEntriesB = entriesByPlantB.get(plantId) ?? [];

      let harvestWeightA = 0;
      for (const e of plantEntriesA) {
        if (e.activityType === "harvest" && e.harvestWeight != null) {
          harvestWeightA += e.harvestWeight;
        }
      }

      let harvestWeightB = 0;
      for (const e of plantEntriesB) {
        if (e.activityType === "harvest" && e.harvestWeight != null) {
          harvestWeightB += e.harvestWeight;
        }
      }

      comparisons.push({
        plantId,
        plant,
        plantingA,
        plantingB,
        journalCountA: plantEntriesA.length,
        journalCountB: plantEntriesB.length,
        harvestWeightA,
        harvestWeightB,
      });
    }

    comparisons.sort((a, b) => {
      const nameA = a.plant.nickname ?? a.plant.species;
      const nameB = b.plant.nickname ?? b.plant.species;
      return nameA.localeCompare(nameB);
    });

    const whatWorked = comparisons.filter(
      (c) =>
        c.plantingA.outcome === "thrived" || c.plantingB.outcome === "thrived",
    );

    const whatToChange = comparisons.filter(
      (c) =>
        c.plantingA.outcome === "failed" || c.plantingB.outcome === "failed",
    );

    return { comparisons, statsA, statsB, whatWorked, whatToChange };
  }, [plantingsA, plantingsB, entriesA, entriesB, plantMap]);

  const seasonA = seasons?.find((s) => s.id === seasonIdA);
  const seasonB = seasons?.find((s) => s.id === seasonIdB);
  const hasBothSeasons = seasonIdA !== "" && seasonIdB !== "" && seasonIdA !== seasonIdB;

  if (seasons === undefined) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4" role="status" aria-label="Loading seasons">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/settings"
          className="rounded-full p-1.5 text-soil-600 transition-colors hover:bg-cream-200"
          aria-label="Back to settings"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-2xl font-bold text-green-800">
          Compare Seasons
        </h1>
      </div>

      {/* Season selectors */}
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="season-a" className="mb-1 block text-sm font-medium text-soil-700">
              Season A
            </label>
            <select
              id="season-a"
              value={seasonIdA}
              onChange={(e) => setSeasonIdA(e.target.value)}
              className={selectClass}
            >
              <option value="">Select season...</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id} disabled={s.id === seasonIdB}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="season-b" className="mb-1 block text-sm font-medium text-soil-700">
              Season B
            </label>
            <select
              id="season-b"
              value={seasonIdB}
              onChange={(e) => setSeasonIdB(e.target.value)}
              className={selectClass}
            >
              <option value="">Select season...</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id} disabled={s.id === seasonIdA}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {seasons.length < 2 && (
        <Card>
          <p className="text-center text-sm text-soil-500">
            You need at least two seasons to compare. Create seasons in{" "}
            <Link to="/settings" className="text-green-700 hover:underline">
              Settings
            </Link>.
          </p>
        </Card>
      )}

      {hasBothSeasons && statsA && statsB && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatsCard
              label={seasonA?.name ?? "Season A"}
              stats={statsA}
            />
            <StatsCard
              label={seasonB?.name ?? "Season B"}
              stats={statsB}
            />
          </div>

          {/* Plant-by-plant comparison */}
          {comparisons.length > 0 ? (
            <Card>
              <h2 className="font-display text-lg font-semibold text-green-800">
                Side-by-Side
              </h2>
              <p className="mt-1 text-xs text-soil-500">
                {String(comparisons.length)} plant{comparisons.length !== 1 ? "s" : ""} grown in both seasons
              </p>

              <div className="mt-3 divide-y divide-cream-200">
                {comparisons.map((c) => (
                  <ComparisonRow
                    key={c.plantId}
                    comparison={c}
                    seasonNameA={seasonA?.name ?? "A"}
                    seasonNameB={seasonB?.name ?? "B"}
                  />
                ))}
              </div>
            </Card>
          ) : (
            <Card>
              <p className="text-center text-sm text-soil-500">
                No plants were grown in both seasons.
              </p>
            </Card>
          )}

          {/* What worked */}
          {whatWorked.length > 0 && (
            <Card>
              <h2 className="font-display text-lg font-semibold text-green-800">
                What Worked
              </h2>
              <p className="mt-1 text-xs text-soil-500">
                Plants that thrived in at least one season
              </p>
              <ul className="mt-3 space-y-2">
                {whatWorked.map((c) => {
                  const name = c.plant.nickname ?? c.plant.species;
                  const thrivedIn: string[] = [];
                  if (c.plantingA.outcome === "thrived") thrivedIn.push(seasonA?.name ?? "A");
                  if (c.plantingB.outcome === "thrived") thrivedIn.push(seasonB?.name ?? "B");
                  return (
                    <li key={c.plantId} className="flex items-center justify-between">
                      <Link
                        to={`/plants/${c.plantId}`}
                        className="text-sm font-medium text-soil-900 hover:text-green-700"
                      >
                        {name}
                      </Link>
                      <span className="text-xs text-soil-500">
                        Thrived in {thrivedIn.join(" & ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {/* What to change */}
          {whatToChange.length > 0 && (
            <Card>
              <h2 className="font-display text-lg font-semibold text-terracotta-500">
                What to Change
              </h2>
              <p className="mt-1 text-xs text-soil-500">
                Plants that failed in at least one season
              </p>
              <ul className="mt-3 space-y-2">
                {whatToChange.map((c) => {
                  const name = c.plant.nickname ?? c.plant.species;
                  const failedIn: string[] = [];
                  if (c.plantingA.outcome === "failed") failedIn.push(seasonA?.name ?? "A");
                  if (c.plantingB.outcome === "failed") failedIn.push(seasonB?.name ?? "B");
                  return (
                    <li key={c.plantId} className="flex items-center justify-between">
                      <Link
                        to={`/plants/${c.plantId}`}
                        className="text-sm font-medium text-soil-900 hover:text-green-700"
                      >
                        {name}
                      </Link>
                      <span className="text-xs text-terracotta-500">
                        Failed in {failedIn.join(" & ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Stats card ───

function StatsCard({ label, stats }: { label: string; stats: SeasonStats }) {
  return (
    <Card>
      <h3 className="font-display text-sm font-semibold text-green-800 truncate">
        {label}
      </h3>
      <dl className="mt-2 space-y-1.5">
        <div className="flex justify-between">
          <dt className="text-xs text-soil-500">Plants</dt>
          <dd className="text-sm font-semibold text-soil-900">
            {String(stats.totalPlants)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-xs text-soil-500">Success rate</dt>
          <dd className="text-sm font-semibold text-soil-900">
            {String(Math.round(stats.successRate * 100))}%
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-xs text-soil-500">Harvest</dt>
          <dd className="text-sm font-semibold text-soil-900">
            {stats.totalHarvestWeight > 0 ? formatWeight(stats.totalHarvestWeight) : "—"}
          </dd>
        </div>
        <div className="flex gap-1 pt-1">
          <Badge variant="success">{String(stats.thrived)}</Badge>
          <Badge variant="warning">{String(stats.ok)}</Badge>
          <Badge variant="danger">{String(stats.failed)}</Badge>
          <Badge variant="default">{String(stats.unknown)}</Badge>
        </div>
      </dl>
    </Card>
  );
}

// ─── Comparison row ───

function ComparisonRow({
  comparison: c,
  seasonNameA,
  seasonNameB,
}: {
  comparison: PlantComparison;
  seasonNameA: string;
  seasonNameB: string;
}) {
  const name = c.plant.nickname ?? c.plant.species;

  return (
    <div className="py-3">
      <Link
        to={`/plants/${c.plantId}`}
        className="text-sm font-semibold text-soil-900 hover:text-green-700"
      >
        {name}
      </Link>
      {c.plant.nickname && (
        <span className="ml-1.5 text-xs text-soil-500 italic">
          {c.plant.species}
        </span>
      )}

      <div className="mt-2 grid grid-cols-2 gap-3">
        <PlantingColumn
          seasonName={seasonNameA}
          planting={c.plantingA}
          journalCount={c.journalCountA}
          harvestWeight={c.harvestWeightA}
        />
        <PlantingColumn
          seasonName={seasonNameB}
          planting={c.plantingB}
          journalCount={c.journalCountB}
          harvestWeight={c.harvestWeightB}
        />
      </div>
    </div>
  );
}

function PlantingColumn({
  seasonName,
  planting,
  journalCount,
  harvestWeight,
}: {
  seasonName: string;
  planting: Planting;
  journalCount: number;
  harvestWeight: number;
}) {
  const outcome = planting.outcome ?? "unknown";

  return (
    <div className="rounded-lg bg-cream-50 p-2">
      <p className="text-xs font-medium text-soil-600 truncate">{seasonName}</p>
      <div className="mt-1">
        <Badge variant={outcomeVariant[outcome] ?? "default"}>
          {outcomeLabel[outcome] ?? outcome}
        </Badge>
      </div>
      <dl className="mt-1.5 space-y-0.5">
        {planting.datePlanted && (
          <div className="flex justify-between">
            <dt className="text-[11px] text-soil-400">Planted</dt>
            <dd className="text-[11px] text-soil-600">
              {format(parseISO(planting.datePlanted), "MMM d")}
            </dd>
          </div>
        )}
        {planting.dateRemoved && (
          <div className="flex justify-between">
            <dt className="text-[11px] text-soil-400">Removed</dt>
            <dd className="text-[11px] text-soil-600">
              {format(parseISO(planting.dateRemoved), "MMM d")}
            </dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-[11px] text-soil-400">Entries</dt>
          <dd className="text-[11px] text-soil-600">{String(journalCount)}</dd>
        </div>
        {harvestWeight > 0 && (
          <div className="flex justify-between">
            <dt className="text-[11px] text-soil-400">Harvest</dt>
            <dd className="text-[11px] text-soil-600">
              {formatWeight(harvestWeight)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
