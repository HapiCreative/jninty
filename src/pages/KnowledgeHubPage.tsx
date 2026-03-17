import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import { userPlantKnowledgeRepository } from "../db/index.ts";
import { loadAllKnowledgeItems } from "../services/knowledgeBase";
import { PLANT_CATEGORIES } from "../constants/knowledgeCategories.ts";
import { TYPE_LABELS } from "../constants/plantLabels";
import { SUN_LABELS, WATER_LABELS, SOURCE_LABELS } from "../constants/knowledgeLabels";
import { useDebounce } from "../hooks/useDebounce";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Input from "../components/ui/Input";
import { PlusIcon } from "../components/icons";
import Skeleton from "../components/ui/Skeleton";

// ─── Category Icons ───

function VegetableIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8 2 4 6 4 12s4 10 8 10c2 0 4-1 5.5-3" />
      <path d="M12 2c4 0 8 4 8 10" />
      <path d="M12 2v4" />
      <path d="M10 6c1 1 3 1 4 0" />
    </svg>
  );
}

function FruitIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
      <path d="M10 2c1 1 2 3 2 5" />
      <path d="M14 2c-1 1-2 3-2 5" />
    </svg>
  );
}

function FlowerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M12 4a2.5 2.5 0 0 0 0 5" />
      <path d="M17.5 8a2.5 2.5 0 0 0-4.5 1" />
      <path d="M19 13.5a2.5 2.5 0 0 0-5-.5" />
      <path d="M16.5 19a2.5 2.5 0 0 0-1.5-4.5" />
      <path d="M12 21a2.5 2.5 0 0 0 0-5" />
      <path d="M6.5 19a2.5 2.5 0 0 0 2-4.5" />
      <path d="M5 13.5a2.5 2.5 0 0 0 5-.5" />
      <path d="M6.5 8a2.5 2.5 0 0 0 4.5 1" />
      <path d="M12 4a2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}

function HerbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 20c3-3 7-3 12-8" />
      <path d="M18 12c-3 0-6 1-8 3" />
      <path d="M6 20c0-5 2-8 6-10" />
      <path d="M12 10c-2-3-1-7 2-8" />
    </svg>
  );
}

const CATEGORY_ICONS: Record<string, typeof VegetableIcon> = {
  vegetables: VegetableIcon,
  fruits: FruitIcon,
  flowers: FlowerIcon,
  herbs: HerbIcon,
};

export default function KnowledgeHubPage() {
  const userEntries = usePouchQuery(() =>
    userPlantKnowledgeRepository.getAll(),
  );

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);

  const allItems = useMemo(
    () => loadAllKnowledgeItems(userEntries ?? []),
    [userEntries],
  );

  // Search results (only when searching)
  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) return null;
    const q = debouncedQuery.toLowerCase();
    return allItems.filter(
      (item) =>
        item.data.commonName.toLowerCase().includes(q) ||
        item.data.species.toLowerCase().includes(q) ||
        (item.data.variety && item.data.variety.toLowerCase().includes(q)),
    );
  }, [allItems, debouncedQuery]);


  if (userEntries === undefined) {
    return (
      <div className="mx-auto max-w-5xl p-4" role="status" aria-label="Loading knowledge base">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-10 w-full" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border-default bg-surface-elevated p-6">
              <Skeleton className="mx-auto h-10 w-10 rounded-full" />
              <Skeleton className="mx-auto mt-3 h-5 w-20" />
              <Skeleton className="mx-auto mt-1 h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-heading">
          Knowledge Base
        </h1>
        <span className="text-sm text-text-secondary">
          {allItems.length} {allItems.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Search bar */}
      <div className="mt-4">
        <Input
          type="search"
          placeholder="Search by name, species, or variety..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search knowledge base"
        />
      </div>

      {/* Search results mode */}
      {searchResults !== null ? (
        searchResults.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="text-lg font-medium text-text-secondary">
              No entries match your search
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Try a different search term.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {searchResults.map((item) => (
              <Link key={item.id} to={`/knowledge/${item.id}`}>
                <Card className="p-4 transition-shadow hover:shadow-md">
                  <p className="font-display font-semibold text-text-primary truncate">
                    {item.data.commonName}
                  </p>
                  <p className="mt-0.5 text-sm text-text-secondary truncate italic">
                    {item.data.species}
                    {item.data.variety ? ` '${item.data.variety}'` : ""}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
                    <span>{SUN_LABELS[item.data.sunNeeds]}</span>
                    <span>&middot;</span>
                    <span>{WATER_LABELS[item.data.waterNeeds]} water</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge>{TYPE_LABELS[item.data.plantType]}</Badge>
                    <Badge variant={item.source === "builtin" ? "success" : "warning"}>
                      {SOURCE_LABELS[item.source]}
                    </Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )
      ) : (
        /* Category cards mode */
        <>
          <div className="mt-6 grid grid-cols-2 gap-4">
            {PLANT_CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.slug];
              return (
                <Link key={cat.slug} to={`/knowledge/plants/${cat.slug}`}>
                  <Card className="flex flex-col items-center px-6 py-10 text-center transition-shadow hover:shadow-md">
                    {Icon && <Icon className="h-14 w-14 text-primary" />}
                    <p className="mt-4 font-display text-xl font-semibold text-text-primary">
                      {cat.label}
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Custom entries section */}
          {(() => {
            const customItems = allItems.filter((i) => i.source === "custom");
            if (customItems.length === 0) return null;
            return (
              <div className="mt-8">
                <h2 className="font-display text-lg font-semibold text-text-heading">
                  Custom Entries
                </h2>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {customItems.map((item) => (
                    <Link key={item.id} to={`/knowledge/${item.id}`}>
                      <Card className="p-4 transition-shadow hover:shadow-md">
                        <p className="font-display font-semibold text-text-primary truncate">
                          {item.data.commonName}
                        </p>
                        <p className="mt-0.5 text-sm text-text-secondary truncate italic">
                          {item.data.species}
                        </p>
                        <div className="mt-2">
                          <Badge variant="warning">{SOURCE_LABELS[item.source]}</Badge>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* Floating add button */}
      <Link
        to="/knowledge/new"
        aria-label="Add knowledge entry"
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-text-on-primary shadow-lg transition-transform hover:bg-primary-hover active:scale-95 md:bottom-6"
      >
        <PlusIcon className="h-7 w-7" />
      </Link>
    </div>
  );
}
