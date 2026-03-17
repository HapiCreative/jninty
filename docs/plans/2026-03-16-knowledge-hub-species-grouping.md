# Knowledge Hub & Species Grouping Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the Knowledge Browser into a hub → category → species → variety drill-down, grouping plants by species within top-level categories (Vegetables, Fruits, Flowers, Herbs), future-proofed for non-plant knowledge categories (diseases, etc.).

**Architecture:** The flat `KnowledgeBrowserPage` becomes a `KnowledgeHubPage` showing category cards. Two new pages — `KnowledgeCategoryPage` (species grid within a category) and `KnowledgeSpeciesPage` (varieties list for a species) — provide the drill-down. A new `knowledgeCategories.ts` constants file defines the category registry, making it trivial to add future categories (diseases, pests, techniques). All grouping is UI-only — the flat JSON data and `knowledgeBase.ts` service are unchanged. A new `groupBySpecies()` helper in `knowledgeBase.ts` supports the UI grouping.

**Tech Stack:** React 18, React Router v7, TypeScript (strict), Tailwind CSS v4, existing Card/Badge/Skeleton components

---

## Routing Changes

| Route | Page | Purpose |
|---|---|---|
| `/knowledge` | `KnowledgeHubPage` | Category cards + global search |
| `/knowledge/plants/:category` | `KnowledgeCategoryPage` | Species grid within category |
| `/knowledge/species/:speciesSlug` | `KnowledgeSpeciesPage` | Species detail + variety list |
| `/knowledge/:id` | `KnowledgeDetailPage` (existing) | Single variety detail |
| `/knowledge/new` | `KnowledgeFormPage` (existing) | Create custom entry |
| `/knowledge/:id/edit` | `KnowledgeFormPage` (existing) | Edit custom entry |

**Route ordering matters:** `/knowledge/plants/:category` and `/knowledge/species/:speciesSlug` must come before `/knowledge/:id` so the literal `plants` and `species` segments match first.

---

## Task 1: Knowledge Category Registry

Define the category cards and their metadata in a new constants file. This is the extensibility point for future categories (diseases, etc.).

**Files:**
- Create: `src/constants/knowledgeCategories.ts`
- Test: `src/constants/knowledgeCategories.test.ts`

**Step 1: Write the test**

```ts
// src/constants/knowledgeCategories.test.ts
import { describe, it, expect } from "vitest";
import {
  PLANT_CATEGORIES,
  ALL_KNOWLEDGE_SECTIONS,
  getCategoryBySlug,
} from "./knowledgeCategories.ts";

describe("knowledgeCategories", () => {
  it("defines 4 plant categories", () => {
    expect(PLANT_CATEGORIES).toHaveLength(4);
  });

  it("each category has required fields", () => {
    for (const cat of PLANT_CATEGORIES) {
      expect(cat.slug).toBeTruthy();
      expect(cat.label).toBeTruthy();
      expect(cat.description).toBeTruthy();
      expect(cat.plantTypes.length).toBeGreaterThan(0);
    }
  });

  it("ALL_KNOWLEDGE_SECTIONS includes a plants section", () => {
    const plants = ALL_KNOWLEDGE_SECTIONS.find((s) => s.slug === "plants");
    expect(plants).toBeDefined();
    expect(plants?.label).toBe("Plants");
  });

  it("getCategoryBySlug finds vegetables", () => {
    const cat = getCategoryBySlug("vegetables");
    expect(cat).toBeDefined();
    expect(cat?.label).toBe("Vegetables");
  });

  it("getCategoryBySlug returns undefined for unknown slug", () => {
    expect(getCategoryBySlug("unknown")).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/constants/knowledgeCategories.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```ts
// src/constants/knowledgeCategories.ts
import type { PlantType } from "../types/index.ts";

export interface PlantCategory {
  slug: string;
  label: string;
  description: string;
  /** Which plantType values belong in this category */
  plantTypes: PlantType[];
}

/** Top-level knowledge sections (plants now, diseases/techniques later) */
export interface KnowledgeSection {
  slug: string;
  label: string;
  description: string;
  route: string;
}

export const PLANT_CATEGORIES: PlantCategory[] = [
  {
    slug: "vegetables",
    label: "Vegetables",
    description: "Edible crops, roots, and leafy greens",
    plantTypes: ["vegetable"],
  },
  {
    slug: "fruits",
    label: "Fruits",
    description: "Fruit trees, berries, and vine fruits",
    plantTypes: ["fruit_tree", "berry"],
  },
  {
    slug: "flowers",
    label: "Flowers",
    description: "Annuals, perennials, and ornamental blooms",
    plantTypes: ["flower", "ornamental"],
  },
  {
    slug: "herbs",
    label: "Herbs",
    description: "Culinary and medicinal herbs",
    plantTypes: ["herb"],
  },
];

/** All top-level knowledge sections. Add diseases, techniques, etc. here later. */
export const ALL_KNOWLEDGE_SECTIONS: KnowledgeSection[] = [
  {
    slug: "plants",
    label: "Plants",
    description: "Browse plant species and varieties",
    route: "/knowledge",
  },
  // Future: { slug: "diseases", label: "Diseases", ... }
  // Future: { slug: "pests", label: "Pests", ... }
];

export function getCategoryBySlug(slug: string): PlantCategory | undefined {
  return PLANT_CATEGORIES.find((c) => c.slug === slug);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/constants/knowledgeCategories.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/constants/knowledgeCategories.ts src/constants/knowledgeCategories.test.ts
git commit -m "feat: add knowledge category registry for hub grouping"
```

---

## Task 2: Species Grouping Helper

Add a `groupBySpecies()` function to `knowledgeBase.ts` that groups `KnowledgeBaseItem[]` by species and returns a sorted array of species groups. Also add a `speciesSlug()` utility for URL-safe species identifiers.

**Files:**
- Modify: `src/services/knowledgeBase.ts`
- Modify: `src/services/knowledgeBaseTypes.ts`
- Test: `src/services/knowledgeBase.test.ts` (add new describe block)

**Step 1: Add the SpeciesGroup type**

Add to `src/services/knowledgeBaseTypes.ts`:

```ts
export interface SpeciesGroup {
  species: string;
  speciesSlug: string;
  commonName: string; // commonName of the first (base) entry
  family?: string;
  entries: KnowledgeBaseItem[];
}
```

**Step 2: Write the failing tests**

Add to `src/services/knowledgeBase.test.ts`:

```ts
import {
  // ... existing imports ...
  groupBySpecies,
  speciesSlug,
} from "./knowledgeBase.ts";

describe("speciesSlug", () => {
  it("slugifies a species name", () => {
    expect(speciesSlug("Solanum lycopersicum")).toBe("solanum-lycopersicum");
  });

  it("handles special characters", () => {
    expect(speciesSlug("Fragaria × ananassa")).toBe("fragaria-ananassa");
  });
});

describe("groupBySpecies", () => {
  it("groups items by species", () => {
    const items = loadAllKnowledgeItems([]);
    const groups = groupBySpecies(items);
    // Solanum lycopersicum should have multiple entries (Cherry, Beefsteak, etc.)
    const tomatoes = groups.find(
      (g) => g.species === "Solanum lycopersicum",
    );
    expect(tomatoes).toBeDefined();
    expect(tomatoes!.entries.length).toBeGreaterThan(1);
  });

  it("sorts groups alphabetically by commonName", () => {
    const items = loadAllKnowledgeItems([]);
    const groups = groupBySpecies(items);
    for (let i = 1; i < groups.length; i++) {
      const prev = groups[i - 1]!;
      const curr = groups[i]!;
      expect(
        prev.commonName.localeCompare(curr.commonName),
      ).toBeLessThanOrEqual(0);
    }
  });

  it("includes speciesSlug on each group", () => {
    const items = loadAllKnowledgeItems([]);
    const groups = groupBySpecies(items);
    for (const g of groups) {
      expect(g.speciesSlug).toBeTruthy();
      expect(g.speciesSlug).not.toContain(" ");
    }
  });

  it("works with an empty list", () => {
    expect(groupBySpecies([])).toEqual([]);
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `npx vitest run src/services/knowledgeBase.test.ts`
Expected: FAIL — speciesSlug and groupBySpecies not exported

**Step 4: Implement**

Add to `src/services/knowledgeBase.ts`:

```ts
import type { KnowledgeBaseItem, SchedulablePlant, SpeciesGroup } from "./knowledgeBaseTypes.ts";

// After builtInEntryId function:

/**
 * Generate a URL-safe slug from a species name.
 */
export function speciesSlug(species: string): string {
  return species
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Group KnowledgeBaseItems by species.
 * Returns sorted by the commonName of the first entry in each group.
 */
export function groupBySpecies(items: KnowledgeBaseItem[]): SpeciesGroup[] {
  const map = new Map<string, KnowledgeBaseItem[]>();
  for (const item of items) {
    const key = item.data.species;
    const existing = map.get(key);
    if (existing) {
      existing.push(item);
    } else {
      map.set(key, [item]);
    }
  }

  const groups: SpeciesGroup[] = [];
  for (const [species, entries] of map) {
    const first = entries[0]!;
    groups.push({
      species,
      speciesSlug: speciesSlug(species),
      commonName: first.data.commonName,
      family: first.data.family,
      entries,
    });
  }

  return groups.sort((a, b) => a.commonName.localeCompare(b.commonName));
}
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/services/knowledgeBase.test.ts`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/services/knowledgeBase.ts src/services/knowledgeBaseTypes.ts src/services/knowledgeBase.test.ts
git commit -m "feat: add groupBySpecies helper and speciesSlug utility"
```

---

## Task 3: KnowledgeHubPage

Replace the flat `KnowledgeBrowserPage` with a hub showing category cards. Keep the search bar — when a search query is active, show flat filtered results (current behavior). When no search, show category cards.

**Files:**
- Modify: `src/pages/KnowledgeBrowserPage.tsx` (rename to `KnowledgeHubPage.tsx`)
- Modify: `src/App.tsx` (update import + add new routes)

**Step 1: Rename and rewrite the page**

Rename `src/pages/KnowledgeBrowserPage.tsx` → `src/pages/KnowledgeHubPage.tsx`.

The new page content:

```tsx
// src/pages/KnowledgeHubPage.tsx
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

function BookPlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8" />
      <path d="M8 11h6" />
    </svg>
  );
}

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

  // Count entries per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of PLANT_CATEGORIES) {
      counts[cat.slug] = allItems.filter((item) =>
        cat.plantTypes.includes(item.data.plantType),
      ).length;
    }
    return counts;
  }, [allItems]);

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
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {PLANT_CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.slug];
              const count = categoryCounts[cat.slug] ?? 0;
              return (
                <Link key={cat.slug} to={`/knowledge/plants/${cat.slug}`}>
                  <Card className="flex flex-col items-center p-6 text-center transition-shadow hover:shadow-md">
                    {Icon && <Icon className="h-10 w-10 text-primary" />}
                    <p className="mt-3 font-display text-lg font-semibold text-text-primary">
                      {cat.label}
                    </p>
                    <p className="mt-0.5 text-sm text-text-secondary">
                      {count} {count === 1 ? "entry" : "entries"}
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
```

**Step 2: Update App.tsx imports and routes**

In `src/App.tsx`:

1. Change the import:
```ts
// Before:
import KnowledgeBrowserPage from "./pages/KnowledgeBrowserPage";
// After:
import KnowledgeHubPage from "./pages/KnowledgeHubPage";
```

2. Add lazy imports for new pages (add near other lazy imports at top):
```ts
const KnowledgeCategoryPage = lazy(() => import("./pages/KnowledgeCategoryPage"));
const KnowledgeSpeciesPage = lazy(() => import("./pages/KnowledgeSpeciesPage"));
```

3. Update routes (order matters — specific literal segments before `:id`):
```tsx
<Route path="knowledge" element={<KnowledgeHubPage />} />
<Route path="knowledge/plants/:category" element={
  <Suspense fallback={<div className="flex h-64 items-center justify-center text-text-muted">Loading...</div>}>
    <KnowledgeCategoryPage />
  </Suspense>
} />
<Route path="knowledge/species/:speciesSlug" element={
  <Suspense fallback={<div className="flex h-64 items-center justify-center text-text-muted">Loading...</div>}>
    <KnowledgeSpeciesPage />
  </Suspense>
} />
<Route path="knowledge/new" element={<KnowledgeFormPage />} />
<Route path="knowledge/:id" element={<KnowledgeDetailPage />} />
<Route path="knowledge/:id/edit" element={<KnowledgeFormPage />} />
```

**Step 3: Delete old file**

```bash
rm src/pages/KnowledgeBrowserPage.tsx
```

**Step 4: Verify build compiles**

Run: `npm run build`
Expected: Type-check and build pass (the two lazy pages don't exist yet, so this will fail — create empty placeholder files first)

Create placeholder files to unblock the build:

```tsx
// src/pages/KnowledgeCategoryPage.tsx
export default function KnowledgeCategoryPage() {
  return <div>TODO: Category page</div>;
}
```

```tsx
// src/pages/KnowledgeSpeciesPage.tsx
export default function KnowledgeSpeciesPage() {
  return <div>TODO: Species page</div>;
}
```

**Step 5: Run existing tests**

Run: `npm run test`
Expected: All existing tests pass. If `App.test.tsx` references KnowledgeBrowserPage, update the import.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: replace KnowledgeBrowserPage with KnowledgeHubPage showing category cards"
```

---

## Task 4: KnowledgeCategoryPage

Shows all species within a category as a grid of cards. Each card shows the species common name, scientific name, family, and variety count. Single-variety species link to the detail page; multi-variety species link to the species page.

**Files:**
- Modify: `src/pages/KnowledgeCategoryPage.tsx` (replace placeholder)

**Step 1: Implement the page**

```tsx
// src/pages/KnowledgeCategoryPage.tsx
import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import { userPlantKnowledgeRepository } from "../db/index.ts";
import { loadAllKnowledgeItems, groupBySpecies } from "../services/knowledgeBase";
import { getCategoryBySlug, PLANT_CATEGORIES } from "../constants/knowledgeCategories.ts";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { ChevronLeftIcon } from "../components/icons";
import Skeleton from "../components/ui/Skeleton";

export default function KnowledgeCategoryPage() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();

  const categoryDef = category ? getCategoryBySlug(category) : undefined;

  const userEntries = usePouchQuery(() =>
    userPlantKnowledgeRepository.getAll(),
  );

  const allItems = useMemo(
    () => loadAllKnowledgeItems(userEntries ?? []),
    [userEntries],
  );

  const speciesGroups = useMemo(() => {
    if (!categoryDef) return [];
    const filtered = allItems.filter((item) =>
      categoryDef.plantTypes.includes(item.data.plantType),
    );
    return groupBySpecies(filtered);
  }, [allItems, categoryDef]);

  // Unknown category
  if (!categoryDef) {
    return (
      <div className="p-4 text-center">
        <p className="text-lg font-medium text-text-secondary">
          Category not found
        </p>
        <Link
          to="/knowledge"
          className="mt-2 inline-block text-sm text-text-heading hover:underline"
        >
          Back to Knowledge Base
        </Link>
      </div>
    );
  }

  // Loading
  if (userEntries === undefined) {
    return (
      <div className="mx-auto max-w-5xl p-4" role="status" aria-label="Loading category">
        <Skeleton className="h-8 w-48" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border-default bg-surface-elevated p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
              <Skeleton className="mt-3 h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/knowledge")}
          className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
          aria-label="Back to knowledge base"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-heading">
            {categoryDef.label}
          </h1>
          <p className="text-sm text-text-secondary">
            {speciesGroups.length} {speciesGroups.length === 1 ? "species" : "species"} &middot; {categoryDef.description}
          </p>
        </div>
      </div>

      {/* Species grid */}
      {speciesGroups.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-lg font-medium text-text-secondary">
            No entries in this category
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {speciesGroups.map((group) => {
            const isSingle = group.entries.length === 1;
            const href = isSingle
              ? `/knowledge/${group.entries[0]!.id}`
              : `/knowledge/species/${group.speciesSlug}`;
            return (
              <Link key={group.speciesSlug} to={href}>
                <Card className="p-4 transition-shadow hover:shadow-md">
                  <p className="font-display font-semibold text-text-primary truncate">
                    {group.commonName}
                  </p>
                  <p className="mt-0.5 text-sm text-text-secondary truncate italic">
                    {group.species}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {group.family && (
                      <Badge variant="default">{group.family}</Badge>
                    )}
                    {!isSingle && (
                      <Badge variant="success">
                        {group.entries.length} varieties
                      </Badge>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Verify in dev**

Run: `npm run dev`
Navigate to `/knowledge` → click a category → verify species grid renders.

**Step 4: Commit**

```bash
git add src/pages/KnowledgeCategoryPage.tsx
git commit -m "feat: implement KnowledgeCategoryPage with species grid"
```

---

## Task 5: KnowledgeSpeciesPage

Shows shared species-level info (family, sun, water, companions, pests) at the top, then a grid of variety cards below. Each variety card links to the existing detail page.

**Files:**
- Modify: `src/pages/KnowledgeSpeciesPage.tsx` (replace placeholder)

**Step 1: Implement the page**

```tsx
// src/pages/KnowledgeSpeciesPage.tsx
import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { usePouchQuery } from "../hooks/usePouchQuery.ts";
import { userPlantKnowledgeRepository } from "../db/index.ts";
import {
  loadAllKnowledgeItems,
  groupBySpecies,
} from "../services/knowledgeBase";
import { SUN_LABELS, WATER_LABELS } from "../constants/knowledgeLabels";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { ChevronLeftIcon } from "../components/icons";
import Skeleton from "../components/ui/Skeleton";

export default function KnowledgeSpeciesPage() {
  const { speciesSlug: slug } = useParams<{ speciesSlug: string }>();
  const navigate = useNavigate();

  const userEntries = usePouchQuery(() =>
    userPlantKnowledgeRepository.getAll(),
  );

  const allItems = useMemo(
    () => loadAllKnowledgeItems(userEntries ?? []),
    [userEntries],
  );

  const group = useMemo(() => {
    if (!slug) return undefined;
    const groups = groupBySpecies(allItems);
    return groups.find((g) => g.speciesSlug === slug) ?? null;
  }, [allItems, slug]);

  // Loading
  if (userEntries === undefined || group === undefined) {
    return (
      <div className="mx-auto max-w-3xl p-4" role="status" aria-label="Loading species">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="mt-2 h-5 w-1/2" />
        <Skeleton className="mt-6 h-32 w-full" />
        <Skeleton className="mt-4 h-24 w-full" />
      </div>
    );
  }

  // Not found
  if (group === null) {
    return (
      <div className="p-4 text-center">
        <p className="text-lg font-medium text-text-secondary">
          Species not found
        </p>
        <Link
          to="/knowledge"
          className="mt-2 inline-block text-sm text-text-heading hover:underline"
        >
          Back to Knowledge Base
        </Link>
      </div>
    );
  }

  // Use first entry for shared species-level data
  const representative = group.entries[0]!.data;

  return (
    <div className="mx-auto max-w-3xl pb-8">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
            aria-label="Go back"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold text-text-primary">
              {group.commonName}
            </h1>
            <p className="mt-0.5 text-text-secondary italic">
              {group.species}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {group.family && <Badge variant="default">{group.family}</Badge>}
          <Badge variant="success">
            {group.entries.length} {group.entries.length === 1 ? "variety" : "varieties"}
          </Badge>
          {representative.isPerennial && <Badge variant="default">Perennial</Badge>}
        </div>
      </div>

      <div className="space-y-4 px-4">
        {/* Shared growing info */}
        <Card>
          <h2 className="font-display text-lg font-semibold text-text-heading">
            Growing Info
          </h2>
          <dl className="mt-3 space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-text-secondary">Sun</dt>
              <dd className="text-sm font-medium text-text-primary">
                {SUN_LABELS[representative.sunNeeds]}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-text-secondary">Water</dt>
              <dd className="text-sm font-medium text-text-primary">
                {WATER_LABELS[representative.waterNeeds]}
              </dd>
            </div>
            {representative.soilPreference && (
              <div className="flex justify-between">
                <dt className="text-sm text-text-secondary">Soil</dt>
                <dd className="text-sm font-medium text-text-primary">
                  {representative.soilPreference}
                </dd>
              </div>
            )}
          </dl>
        </Card>

        {/* Shared companions */}
        {((representative.goodCompanions && representative.goodCompanions.length > 0) ||
          (representative.badCompanions && representative.badCompanions.length > 0)) && (
          <Card>
            <h2 className="font-display text-lg font-semibold text-text-heading">
              Companion Planting
            </h2>
            {representative.goodCompanions && representative.goodCompanions.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-text-secondary">Good Companions</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {representative.goodCompanions.map((c) => (
                    <Badge key={c} variant="success">{c}</Badge>
                  ))}
                </div>
              </div>
            )}
            {representative.badCompanions && representative.badCompanions.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-text-secondary">Bad Companions</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {representative.badCompanions.map((c) => (
                    <Badge key={c} variant="danger">{c}</Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Shared pests & diseases */}
        {((representative.commonPests && representative.commonPests.length > 0) ||
          (representative.commonDiseases && representative.commonDiseases.length > 0)) && (
          <Card>
            <h2 className="font-display text-lg font-semibold text-text-heading">
              Common Issues
            </h2>
            {representative.commonPests && representative.commonPests.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-text-secondary">Pests</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {representative.commonPests.map((p) => (
                    <Badge key={p} variant="warning">{p}</Badge>
                  ))}
                </div>
              </div>
            )}
            {representative.commonDiseases && representative.commonDiseases.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-text-secondary">Diseases</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {representative.commonDiseases.map((d) => (
                    <Badge key={d} variant="danger">{d}</Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Varieties grid */}
        <div>
          <h2 className="font-display text-lg font-semibold text-text-heading">
            Varieties
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {group.entries.map((item) => (
              <Link key={item.id} to={`/knowledge/${item.id}`}>
                <Card className="p-4 transition-shadow hover:shadow-md">
                  <p className="font-display font-semibold text-text-primary truncate">
                    {item.data.variety ?? item.data.commonName}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-text-secondary">
                    {item.data.daysToMaturity != null && (
                      <span>{item.data.daysToMaturity}d to maturity</span>
                    )}
                    {item.data.spacingInches != null && (
                      <span>{item.data.spacingInches}" spacing</span>
                    )}
                  </div>
                  {item.data.matureHeightInches != null && (
                    <p className="mt-1 text-xs text-text-secondary">
                      Height: {item.data.matureHeightInches}" &middot; Spread: {item.data.matureSpreadInches ?? "—"}"
                    </p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Verify full flow in dev**

Run: `npm run dev`
- `/knowledge` → hub with 4 category cards
- Click "Vegetables" → species grid
- Click "Tomato" (multi-variety) → species page with varieties
- Click "Cherry" variety → existing detail page
- Back button works at each level

**Step 4: Commit**

```bash
git add src/pages/KnowledgeSpeciesPage.tsx
git commit -m "feat: implement KnowledgeSpeciesPage with shared traits and variety grid"
```

---

## Task 6: Update KnowledgeDetailPage Back Navigation

The detail page currently hardcodes back navigation to `/knowledge`. It should now navigate back using browser history so it returns to whichever page the user came from (category page, species page, or hub search results).

**Files:**
- Modify: `src/pages/KnowledgeDetailPage.tsx`

**Step 1: Update the back button**

In `KnowledgeDetailPage.tsx`, change the back button `onClick` from:

```tsx
onClick={() => navigate("/knowledge")}
```

to:

```tsx
onClick={() => navigate(-1)}
```

Also update the "Back to Knowledge Base" link in the not-found state to still point to `/knowledge` (that's fine as a fallback).

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/pages/KnowledgeDetailPage.tsx
git commit -m "fix: use browser history for knowledge detail back navigation"
```

---

## Task 7: Update Tests

Fix any broken tests (e.g., `App.test.tsx` referencing old component name) and add basic smoke tests for the new pages.

**Files:**
- Modify: any test files that reference `KnowledgeBrowserPage`

**Step 1: Find and fix broken references**

Run: `grep -r "KnowledgeBrowserPage" src/`

If `App.test.tsx` renders the full app and looks for knowledge-related text, update expectations from "Plant Knowledge" to "Knowledge Base" (the new heading).

**Step 2: Run all tests**

Run: `npm run test`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add -A
git commit -m "test: fix broken references after knowledge hub refactor"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Category registry constants + tests | `knowledgeCategories.ts`, test |
| 2 | `groupBySpecies()` + `speciesSlug()` helpers + tests | `knowledgeBase.ts`, types, test |
| 3 | `KnowledgeHubPage` (replaces browser) + routing | page, `App.tsx` |
| 4 | `KnowledgeCategoryPage` (species grid) | page |
| 5 | `KnowledgeSpeciesPage` (shared traits + variety grid) | page |
| 6 | Detail page back navigation fix | `KnowledgeDetailPage.tsx` |
| 7 | Test fixes | various |
