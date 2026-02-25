# Jninty — Design Document

**A personal, open-source garden journal and management PWA**

*Date: February 24, 2026*
*Version: 2.0 (incorporates design review v1)*

---

## 1. Vision & Philosophy

Jninty is a **living garden journal** that knows what you grow, reminds you what to do, and builds a history you can learn from season to season. It treats your garden as a long-term project — not just a seasonal planner — with first-class support for tracking established trees, perennials, and ornamentals alongside annual vegetables and herbs.

**Core principles:**
- **Local-first:** Your data lives on your device. No account required. Works offline in the garden.
- **Open source:** Free forever, community-driven, transparent.
- **Journal-centered:** Planning is important, but recording what *actually happened* is where real gardening wisdom comes from.
- **3-tap logging:** When your hands are dirty, you need to snap a photo, tag a plant, and save — fast.
- **Season-aware:** Every observation, planting, and task belongs to a season — enabling year-over-year learning from day one.

---

## 2. Market Analysis

### 2.1 Competitive Landscape

| App | Strengths | Weaknesses |
|-----|-----------|------------|
| **Seedtime** | Best calendar (2,670+ varieties), journal with photos, winter algorithm | No garden map, limited seed inventory, subscription model |
| **Planter** | Companion planting grid, square-foot layout, frost date auto-detection | Forced square grid, limited without subscription |
| **GrowVeg/Almanac** | Best visual design, crop rotation warnings, 5,000+ weather stations | Subscription ($30-50/yr), web-only, no seed inventory |
| **Seed to Spoon** | AI plant ID (Growbot), weather alerts, health-benefit filtering | Subscription creep, features moved behind paywall |
| **Gardenize** | 45,000+ plant database, photo diary | No planting calendar, no spatial layout |
| **Garden Savvy** | Supplier tracking, seed inventory basics | Clunky UI, limited planning features |

### 2.2 Key Gaps in the Market

1. **No one does seed inventory well.** Forum users resort to messy spreadsheets.
2. **Existing plant tracking is ignored.** Apps assume you start fresh each season — no way to register a 5-year-old apple tree.
3. **Journal quality is poor.** Most offer basic notes; none combine quick capture with structured data logging.
4. **Subscription fatigue.** Users hate losing features and paying $30-50/year.
5. **Outdated UIs.** A Washington Post reviewer tested 18 apps and said most "felt like they were built in 1999."
6. **No open-source option.** The gardening community is passionate and would contribute, but nothing exists for them.
7. **Offline access is limited.** Gardeners need their info in the field with spotty connectivity.
8. **No season modeling.** No app properly separates the long-lived plant from its seasonal behavior — making year-over-year comparison impossible.

### 2.3 Jninty's Differentiation

| Feature | Existing Apps | Jninty |
|---------|--------------|--------|
| Open source | Almost none | Fully open, community-driven |
| Seed inventory | Spreadsheets or nothing | First-class module |
| Existing plant tracking | Assume fresh start each season | Track established trees & perennials |
| Season modeling | None | PlantInstance + Planting per season |
| Journal quality | Basic notes at best | Dual-mode: quick capture + structured data |
| Works offline | Rarely | Local-first by design |
| All plant types | Mostly veggie-only | Veggies, flowers, trees, ornamentals |
| Cost | $10-50/year subscriptions | Free forever |
| Spatial garden map | Some (often clunky) | Grid-based snap-to-grid canvas |
| Search | Basic or none | Client-side full-text indexing |

---

## 3. Platform Decision: Progressive Web App (PWA)

### 3.1 Why PWA

- **One codebase** for desktop and mobile
- **Installable** on homescreen (iOS and Android) without App Store
- **Offline-capable** via service workers
- **Camera access** for photo journaling directly from the PWA
- **No App Store fees** ($99/yr Apple developer fee avoided)
- **Faster development** using web technologies (React, TypeScript)
- **Push notifications** via Notifications API (with user permission)

### 3.2 PWA Trade-offs Accepted

- No native iOS push notifications (PWA notifications have limited support on iOS, improving steadily)
- Slightly less polished than a native Swift app
- IndexedDB storage limits on some browsers (mitigated with photo pipeline + optional cloud sync)
- iOS Safari PWA edge cases (mitigated with early testing + documented limitations)

### 3.3 Alternatives Considered & Rejected

| Option | Why Rejected |
|--------|-------------|
| iOS native only | Limits audience, requires Swift/SwiftUI, $99/yr fee |
| Web app only (no PWA) | No offline, no install, no notifications |
| Web + native iOS | Double maintenance burden for a solo/open-source project |
| React Native | Extra complexity, PWA covers the same ground |

---

## 4. Feature Architecture

### 4.1 Module Overview

```
┌─────────────────────────────────────────────────┐
│                    Jninty                         │
├─────────┬──────────┬──────────┬─────────────────┤
│Dashboard│  Plant   │  Seed    │  Garden         │
│  (Home) │ Inventory│  Bank    │  Journal        │
├─────────┼──────────┼──────────┼─────────────────┤
│ Planting│  Task    │  Garden  │  Plant          │
│ Calendar│  Engine  │  Map     │  Knowledge Base │
├─────────┴──────────┴──────────┴─────────────────┤
│          Seasons  ·  Settings  ·  Export          │
└─────────────────────────────────────────────────┘
```

### 4.2 Module Details

#### Module 1: Dashboard (Home)

The landing screen — at-a-glance view of your garden's status.

- **"Today in your garden"** prompt — "What changed since last time?" with 1-tap quick note
- **This week's tasks** — upcoming and overdue
- **Recent journal entries** — last 5 entries with photo thumbnails
- **Seasonal snapshot** — what's ready to plant, transplant, or harvest this month
- **Weather widget** — current conditions and frost warnings (Open-Meteo API, Phase 2)
- **Quick actions** — big prominent "+Log Entry" CTA, plus "+Add Plant" and "+Add Task"
- **Offline indicator** — clear visual cue when offline + last backup/export timestamp

#### Module 2: Plant Inventory

Your living registry of everything growing in your garden. Uses a two-tier model: **PlantInstance** (the physical, long-lived entity) and **Planting** (its seasonal occurrence in a specific bed).

**PlantInstance (the plant itself):**
- Nickname (e.g., "Backyard Apple Tree")
- Species & variety
- Plant type: vegetable, herb, flower, ornamental, fruit_tree, berry, other
- Is perennial: boolean
- Date acquired (for trees/perennials)
- Source: seed (links to Seed Bank), nursery, cutting, gift, unknown
- Current status: active, dormant, removed, dead
- Tags: custom labels for filtering
- Care notes: free-text for variety-specific observations

**Planting (seasonal placement):**
- Links to PlantInstance + Season + Bed
- Date planted / date removed
- Outcome: thrived, ok, failed, unknown

**Why two tiers:** Your apple tree is one PlantInstance that has a Planting record each season. Your annual tomato is a PlantInstance with one Planting. This enables year-over-year comparison: "How did this tomato variety do in 2025 vs 2026?"

**Views:**
- List/grid view with filters: by type, location, status, tag, season
- Tap a plant → detail page with: photo timeline, all journal entries, linked plantings across seasons
- Quick log button on every plant detail page

#### Module 3: Seed Bank

Track seed packets you own — the biggest gap in the market.

**Each seed entry contains:**
- Variety name & species
- Brand / source / supplier
- Quantity: packet count or weight remaining
- Purchase date
- Expiration / viability date
- Germination rate notes (from your own experience)
- Cost paid
- Storage location (e.g., "fridge box A", "shed drawer 3")
- Linked plantings: which PlantInstance entries came from this seed

**Key interactions:**
- "I planted some" action → deducts quantity, optionally creates a new PlantInstance + Planting entry
- Visual indicators: low stock, expired, approaching expiry
- Sortable by type, expiry date, quantity, brand

#### Module 4: Garden Journal

The heart of the app — dual-mode logging.

**Quick Entry (3-tap mode):**
1. Tap "+" → camera opens
2. Snap photo → tag a plant (optional) → add short text note
3. Save. Done.

Quick Log is accessible from everywhere:
- Dashboard: big CTA
- Plant detail: quick log for that plant
- Garden map: tap bed → quick log in that context

**Structured Entry:**
- Activity type picker: watering, fertilizing, pruning, pest sighting, disease, harvesting, transplanting, general observation
- Plant selector (which plant is this about?)
- Bed/zone selector (or garden-wide)
- Season auto-assigned (current active season)
- Quantity fields (e.g., harvest weight, fertilizer amount)
- Photo attachment
- Weather auto-captured at time of entry (if online)

**Journal Feed:**
- Chronological feed (newest first) — virtualized with react-window for performance
- Filter by: plant, activity type, date range, bed/zone, season
- Full-text search via MiniSearch index (plant names, entry body/title)
- Per-plant view: all journal entries for a specific plant as a timeline
- Lazy-loaded photo thumbnails; full-size on tap

**Growth Milestones:**
- Tag entries as milestones: "first sprout", "first flower", "first fruit", "peak harvest"
- Photo timeline per plant auto-assembled from milestone entries

#### Module 5: Planting Calendar

Location-aware seasonal planning with deterministic math.

**Configuration (Settings):**
- Growing zone (manual selection from dropdown)
- Last spring frost date (manual input)
- First fall frost date (manual input)

**Calendar Windows (computed from PlantKnowledge offsets):**
- Indoor seed start: `lastFrostDate - indoorStartWeeksBeforeLastFrost * 7`
- Transplant: `lastFrostDate + transplantWeeksAfterLastFrost * 7`
- Direct sow: `lastFrostDate + directSowWeeksAfterLastFrost * 7` (or before, using negative offset)
- Estimated harvest: `plantDate + daysToMaturity`
- Fallback: "No planting window available — missing data" when offsets are unknown

**Calendar Features:**
- Month view showing windows color-coded by activity type
- Frost date markers clearly visible
- Works for all plant types (not just vegetables)
- Season-scoped: shows current season by default, can browse past seasons

**Not in scope (intentional):** Automatic geolocation detection. User manually configures their single zone.

#### Module 6: Task Engine

Hybrid task management combining manual control with smart automation.

**Manual Tasks:**
- Create any to-do with title, description, due date, linked plant/bed
- Checkbox completion
- Priority levels: urgent, normal, low

**Auto-Generated Tasks (via TaskRule system):**
- Rules define which plants get which tasks, triggered by frost date offsets or seasonal dates
- System generates suggestions from rules matched to your plants
- Presented as suggestions you accept or dismiss
- Provenance tracked: ruleId, generatedAt, dismissedAt

**TaskRule schema (bundled with app + knowledge base):**
```
TaskRule {
  id: string
  appliesTo: {
    plantType?: PlantType
    species?: string
    tagsAny?: string[]
  }
  trigger: {
    type: "relative_to_last_frost" | "relative_to_first_frost" | "seasonal" | "fixed_date"
    offsetDays?: number    // e.g., -42 for 6 weeks before last frost
    month?: number         // for seasonal rules
    day?: number           // for fixed_date
  }
  task: {
    title: string
    activityType?: ActivityType
    defaultPriority?: "urgent" | "normal" | "low"
  }
}
```

**Recurring Tasks:**
- Set any task to repeat: daily, weekly, every N days, monthly, seasonally
- Examples: "Water container plants" (every 2 days), "Fertilize citrus" (every 6 weeks)

**Calendar View:**
- Integrated with Planting Calendar — see tasks alongside planting windows
- Week view for daily planning
- Overdue task highlighting

#### Module 7: Garden Map

Visual, interactive canvas for spatial garden layout.

**Canvas:**
- Grid-based with configurable scale (1 square = 1 ft or 1 m, user choice)
- Snap-to-grid for clean alignment
- Adjustable total garden dimensions
- **Rectangles only** in initial implementation
- Cap rendered elements (beds + plant tokens) for mobile performance
- Lazy-load the map route and canvas data

**Drawing Tools:**
- Draw rectangular beds by click-drag on grid
- Pre-made shapes: raised bed, container/pot, greenhouse, compost bin, path, fence, water source
- Color-code beds by type or custom colors
- Label each bed/zone with custom name

**Plant Placement:**
- Drag plants from inventory onto beds (creates/updates Planting record)
- See plant spacing guidance on the grid
- Visual density: how full is each bed?

**Bed Attributes:**
- Sun exposure: full sun, partial shade, full shade
- Soil type notes
- Irrigation method
- Microclimate notes

**Data Connection:**
- Tap a bed → see all plants currently in it
- Tap a bed → quick log in that bed's context
- Journal entries can be tagged to a bed
- Tasks can be assigned to a bed

**Data Storage:**
- Bed entities in DB are the source of truth
- Canvas JSON is a derived/cached representation (versioned)

**Season Layers (Phase 3):**
- Toggle between spring/summer/fall/winter views
- See what's growing in each bed at different times
- Enables visual succession planting

**Tech:** Konva.js (React-friendly, good touch support). Saves as JSON.

#### Module 8: Plant Knowledge Base

Searchable reference database — community-contributable.

**PlantKnowledge schema:**
```
PlantKnowledge {
  species: string
  variety?: string
  commonName: string
  plantType: PlantType
  isPerennial: boolean

  // Planting timing offsets (deterministic calendar math)
  indoorStartWeeksBeforeLastFrost?: number
  transplantWeeksAfterLastFrost?: number
  directSowWeeksBeforeLastFrost?: number
  directSowWeeksAfterLastFrost?: number
  daysToGermination?: number
  daysToMaturity?: number

  // Care info
  spacingInches?: number
  sunNeeds: "full_sun" | "partial_shade" | "full_shade"
  waterNeeds: "low" | "moderate" | "high"
  soilPreference?: string
  matureHeightInches?: number
  matureSpreadInches?: number
  growthRate?: "slow" | "moderate" | "fast"

  // Companion planting
  goodCompanions?: string[]     // species names
  badCompanions?: string[]

  // Common issues
  commonPests?: string[]
  commonDiseases?: string[]
}
```

**Open-source contribution model:**
- Knowledge base stored as structured JSON files in `data/plants/` directory
- Community can submit PRs to add/correct plant data
- Validated with Zod schemas on import
- No proprietary database lock-in

---

## 5. Technical Architecture

### 5.1 Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | React 18+ with TypeScript (strict mode) | Huge ecosystem, PWA-friendly, strong typing |
| **TS Config** | `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` | Catch bugs at compile time, not runtime |
| **Validation** | Zod | Runtime validation for DB imports/exports, future sync payloads, knowledge base data |
| **Dates** | date-fns | Frost date offset math, calendar windows, recurring task computation |
| **Styling** | Tailwind CSS | Rapid responsive design, mobile-first, warm/organic theme |
| **PWA** | Vite PWA Plugin + Workbox | Service worker generation, offline caching, background sync |
| **Local DB** | IndexedDB via Dexie.js | Primary data store, offline-first, fast queries |
| **Search** | MiniSearch | Lightweight client-side full-text search for journal entries + plant names |
| **Virtualization** | react-window | Virtualized journal feed for performance at scale |
| **Canvas** | Konva.js (Phase 2) | React-friendly canvas for garden map, touch gestures |
| **Weather** | Open-Meteo API (Phase 2) | Free, no API key required, global coverage |
| **Build** | Vite | Fast dev server, good PWA plugin ecosystem |
| **Testing** | Vitest + React Testing Library | Fast unit & component tests |

### 5.2 Local-First Architecture

```
┌──────────────────────────────────────────┐
│              PWA (Browser)                │
│  ┌──────────────┐  ┌──────────────────┐  │
│  │   React App  │  │  Workbox (SW)    │  │
│  │  + MiniSearch│  │  + Precaching    │  │
│  └──────┬───────┘  └────────┬─────────┘  │
│         │                   │            │
│  ┌──────▼───────────────────▼──────────┐ │
│  │       IndexedDB (Dexie.js)          │ │
│  │  PlantInstances | Plantings | Seeds │ │
│  │  JournalEntries | Tasks | Seasons   │ │
│  │  GardenBeds | Settings | TaskRules  │ │
│  │  SearchIndex (MiniSearch serialized)│ │
│  └──────────────┬──────────────────────┘ │
│                 │                        │
│  ┌──────────────▼──────────────────────┐ │
│  │        Photo Storage                │ │
│  │  Thumbnails: IndexedDB blobs        │ │
│  │  Full-size: File System Access API  │ │
│  │  Fallback: IndexedDB blobs          │ │
│  └─────────────────────────────────────┘ │
└──────────────────┬───────────────────────┘
                   │ (optional, when online)
         ┌─────────▼─────────┐
         │   Cloud Backup    │
         │  (Supabase/S3)    │
         │  Future Phase     │
         └───────────────────┘
```

**Key behaviors:**
- All writes go to IndexedDB first — instant, no network required
- Photos processed through image pipeline (see 5.4)
- MiniSearch index maintained incrementally; serialized to IndexedDB for persistence
- Optional cloud sync is a future enhancement, not required
- No account creation needed to use the app
- Data export always available as JSON + photos ZIP

### 5.3 Data Model

All entities include `version` and `deletedAt` fields from day one to support future sync, undo, and schema migrations.

```typescript
// ─── Base Fields (on every entity) ───

type BaseEntity = {
  id: string;            // UUID
  version: number;       // incremented on every update (for sync/conflict resolution)
  createdAt: string;     // ISO timestamp
  updatedAt: string;     // ISO timestamp
  deletedAt?: string;    // ISO timestamp (soft delete / tombstone for future sync)
};

// ─── Season ───

type Season = BaseEntity & {
  name: string;            // "2026 Growing Season"
  year: number;            // 2026
  startDate: string;       // ISO date
  endDate: string;         // ISO date
  isActive: boolean;       // only one active season at a time
};

// ─── Plant Instance (the physical, long-lived plant) ───

type PlantType = "vegetable" | "herb" | "flower" | "ornamental"
              | "fruit_tree" | "berry" | "other";
type PlantSource = "seed" | "nursery" | "cutting" | "gift" | "unknown";
type PlantStatus = "active" | "dormant" | "harvested" | "removed" | "dead";

type PlantInstance = BaseEntity & {
  nickname?: string;          // "Backyard Apple Tree"
  species: string;            // "Malus domestica"
  variety?: string;           // "Honeycrisp"
  type: PlantType;
  isPerennial: boolean;
  dateAcquired?: string;      // for trees/perennials
  source: PlantSource;
  seedId?: string;            // links to Seed Bank entry
  status: PlantStatus;
  tags: string[];
  careNotes?: string;
};

// ─── Planting (seasonal occurrence of a plant in a bed) ───

type PlantingOutcome = "thrived" | "ok" | "failed" | "unknown";

type Planting = BaseEntity & {
  plantInstanceId: string;    // FK → PlantInstance
  seasonId: string;           // FK → Season
  bedId?: string;             // FK → GardenBed
  datePlanted?: string;       // ISO date
  dateRemoved?: string;       // ISO date
  outcome?: PlantingOutcome;
  notes?: string;
};

// ─── Seed ───

type QuantityUnit = "packets" | "grams" | "ounces" | "count";

type Seed = BaseEntity & {
  name: string;                // "San Marzano Tomato Seeds"
  species: string;
  variety?: string;
  brand?: string;
  supplier?: string;
  quantityRemaining: number;
  quantityUnit: QuantityUnit;
  purchaseDate?: string;
  expiryDate?: string;
  germinationRate?: number;    // 0-100 percentage from your experience
  cost?: number;
  storageLocation?: string;
  notes?: string;
};

// ─── Journal Entry ───

type ActivityType = "watering" | "fertilizing" | "pruning" | "pest" | "disease"
                  | "harvest" | "transplant" | "milestone" | "general";
type MilestoneType = "first_sprout" | "first_flower" | "first_fruit"
                   | "peak_harvest" | "other";

type JournalEntry = BaseEntity & {
  plantInstanceId?: string;    // FK → PlantInstance (optional)
  bedId?: string;              // FK → GardenBed (optional)
  seasonId: string;            // FK → Season (auto-assigned)
  activityType: ActivityType;
  title?: string;
  body: string;                // free-text notes
  photoIds: string[];          // FK → Photo[]
  isMilestone: boolean;
  milestoneType?: MilestoneType;
  harvestWeight?: number;
  weatherSnapshot?: {
    tempC?: number;
    humidity?: number;
    conditions?: string;
  };
  // Search optimization
  bodyLower?: string;          // normalized lowercase for MiniSearch
};

// ─── Photo ───

type Photo = BaseEntity & {
  thumbnailBlob: Blob;         // ~320px wide, always in IndexedDB
  displayBlob?: Blob;          // ~1600px wide (IndexedDB or FS API)
  originalStored: boolean;     // whether original is kept (user opt-in)
  caption?: string;
  width?: number;
  height?: number;
};

// ─── Task ───

type TaskPriority = "urgent" | "normal" | "low";
type RecurrenceType = "daily" | "weekly" | "monthly" | "custom";

type Task = BaseEntity & {
  title: string;
  description?: string;
  plantInstanceId?: string;    // FK → PlantInstance
  bedId?: string;              // FK → GardenBed
  seasonId?: string;           // FK → Season
  dueDate: string;             // ISO date
  priority: TaskPriority;
  isCompleted: boolean;
  completedAt?: string;
  // Auto-generation provenance
  isAutoGenerated: boolean;
  ruleId?: string;             // FK → TaskRule that generated this
  generatedAt?: string;        // when it was generated
  dismissedAt?: string;        // if user dismissed the suggestion
  // Recurrence
  recurrence?: {
    type: RecurrenceType;
    interval: number;          // every N units of type
  };
};

// ─── Task Rule (auto-task generation engine) ───

type TaskTriggerType = "relative_to_last_frost" | "relative_to_first_frost"
                     | "seasonal" | "fixed_date";

type TaskRule = BaseEntity & {
  appliesTo: {
    plantType?: PlantType;
    species?: string;
    tagsAny?: string[];
  };
  trigger: {
    type: TaskTriggerType;
    offsetDays?: number;       // e.g., -42 for 6 weeks before last frost
    month?: number;            // 1-12 for seasonal rules
    day?: number;              // for fixed_date
  };
  task: {
    title: string;
    activityType?: ActivityType;
    defaultPriority?: TaskPriority;
  };
  isBuiltIn: boolean;          // bundled with app vs user-created
};

// ─── Garden Bed ───

type BedType = "vegetable_bed" | "flower_bed" | "fruit_area"
             | "herb_garden" | "container" | "other";
type SunExposure = "full_sun" | "partial_shade" | "full_shade";

type GardenBed = BaseEntity & {
  name: string;                // "North Raised Bed"
  type: BedType;
  color: string;               // hex color for map display
  sunExposure: SunExposure;
  soilType?: string;
  irrigationMethod?: string;
  notes?: string;
  // Grid position data (source of truth for Konva canvas)
  gridX: number;
  gridY: number;
  gridWidth: number;
  gridHeight: number;
  shape: "rectangle";          // only rectangles for now
};

// ─── Settings ───

type Settings = {
  growingZone: string;         // e.g., "7b"
  lastFrostDate: string;       // ISO date, e.g., "2026-04-15"
  firstFrostDate: string;      // ISO date, e.g., "2026-10-20"
  gridUnit: "feet" | "meters";
  temperatureUnit: "fahrenheit" | "celsius";
  gardenName?: string;
  theme: "light" | "dark" | "auto";
  keepOriginalPhotos: boolean; // opt-in to store full originals
  dbSchemaVersion: number;     // for Dexie migrations
  exportVersion: number;       // for export format versioning
};

// ─── Plant Knowledge Base Entry ───

type PlantKnowledge = {
  species: string;
  variety?: string;
  commonName: string;
  plantType: PlantType;
  isPerennial: boolean;
  // Planting timing offsets (deterministic calendar math)
  indoorStartWeeksBeforeLastFrost?: number;
  transplantWeeksAfterLastFrost?: number;
  directSowWeeksBeforeLastFrost?: number;
  directSowWeeksAfterLastFrost?: number;
  daysToGermination?: number;
  daysToMaturity?: number;
  // Care info
  spacingInches?: number;
  sunNeeds: SunExposure;
  waterNeeds: "low" | "moderate" | "high";
  soilPreference?: string;
  matureHeightInches?: number;
  matureSpreadInches?: number;
  growthRate?: "slow" | "moderate" | "fast";
  // Companion planting
  goodCompanions?: string[];
  badCompanions?: string[];
  // Common issues
  commonPests?: string[];
  commonDiseases?: string[];
};
```

### 5.4 Photo Pipeline

Photos are the heaviest data in the app. A disciplined pipeline prevents storage explosion.

**On capture/import:**
1. **Thumbnail** (~320px wide, JPEG 70% quality) — always stored in IndexedDB. Used in journal feed, plant lists.
2. **Display size** (~1600px wide, JPEG 85% quality) — stored via File System Access API where supported, IndexedDB fallback. Used in full-screen photo view.
3. **Original** — only kept if user opts in via `Settings.keepOriginalPhotos`. Stored via File System Access API only (too large for IndexedDB).

**Implementation:**
- Use `<canvas>` element for client-side resize/compression
- Accept camera input, file input, and paste from clipboard
- Process async — show thumbnail immediately, generate display size in background

**Storage dashboard (Settings):**
- "You're using ~X MB. Photos: Y MB. Data: Z MB."
- "Export now" button + optional auto weekly export reminder
- "Clear original photos" to reclaim space

### 5.5 Search Strategy

IndexedDB does not provide full-text search. Jninty uses MiniSearch for client-side indexing.

**Indexed fields:**
- JournalEntry: body, title, activityType
- PlantInstance: nickname, species, variety, tags
- Seed: name, species, variety, brand

**Implementation:**
- MiniSearch index built incrementally (add/update/remove on each DB write)
- Serialized index stored in IndexedDB for fast startup
- Rebuild from scratch available as a fallback (Settings → "Rebuild search index")

**Dexie indexes for filtered queries:**
- JournalEntry: `[seasonId]`, `[plantInstanceId]`, `[bedId]`, `[activityType]`, `[createdAt]`
- Task: `[dueDate]`, `[isCompleted]`, `[seasonId]`
- Planting: `[seasonId]`, `[plantInstanceId]`, `[bedId]`

### 5.6 Database Migrations

Dexie supports schema versioning natively. Migrations are defined from day one.

```typescript
const db = new Dexie("jninty");

db.version(1).stores({
  seasons: "id, year, isActive",
  plantInstances: "id, species, type, status, *tags",
  plantings: "id, plantInstanceId, seasonId, bedId",
  seeds: "id, species, expiryDate",
  journalEntries: "id, plantInstanceId, bedId, seasonId, activityType, createdAt",
  photos: "id, createdAt",
  tasks: "id, dueDate, isCompleted, seasonId",
  taskRules: "id, isBuiltIn",
  gardenBeds: "id",
  settings: "id",
  searchIndex: "id",  // serialized MiniSearch
});

// Future versions add new stores/indexes without breaking existing data
// db.version(2).stores({ ... }).upgrade(tx => { ... });
```

**Schema version tracked in Settings.dbSchemaVersion** for export/import compatibility.

### 5.7 Export/Import Format

Robust from day one to prevent data loss and enable future sync.

**Export structure (ZIP file):**
```
jninty-export-2026-03-15/
├── manifest.json          // { exportVersion: 1, schemaVersion: 1, exportedAt, appVersion }
├── data/
│   ├── seasons.json
│   ├── plantInstances.json
│   ├── plantings.json
│   ├── seeds.json
│   ├── journalEntries.json
│   ├── tasks.json
│   ├── taskRules.json      // user-created only
│   ├── gardenBeds.json
│   └── settings.json
└── photos/
    ├── {photoId}-thumb.jpg
    └── {photoId}-display.jpg
```

**Import behavior:**
- Validate all JSON with Zod schemas
- Check schemaVersion compatibility
- Merge or replace (user chooses)
- Report validation errors without crashing

---

## 6. UI/UX Design Direction

### 6.1 Brand Aesthetic: Warm & Organic

- **Color palette:** Earthy greens, warm browns, cream/linen backgrounds, terracotta accents
- **Typography:** Rounded, friendly font (e.g., Nunito, Quicksand) for headings; clean sans-serif for body
- **Icons:** Hand-drawn or organic style (not flat/corporate)
- **Illustrations:** Subtle botanical line drawings as decorative elements
- **Photos first:** The UI should showcase plant photos prominently — this is a visual journal
- **Texture:** Subtle paper/linen textures on backgrounds (light touch, not overdone)

### 6.2 Navigation

**Bottom tab bar (mobile / PWA installed):**
1. 🏠 Home (Dashboard)
2. 🌱 Plants (Inventory)
3. ➕ Quick Log (center, prominent — the hero)
4. 📅 Calendar
5. 🗺️ Map

**Secondary navigation (accessible from menu or tabs):**
- Seed Bank
- Tasks
- Knowledge Base
- Settings

### 6.3 Key UX Principles

- **3-tap journaling:** Photo → tag plant → save. Everything else is optional. Quick Log is accessible from Home, Plant detail, and Map (tap bed → log).
- **"Today in your garden":** Dashboard opens with a prompt — "What changed since last time?" — encouraging daily 1-tap notes.
- **Mobile-first, desktop-enhanced:** Design for phone use in the garden, enhance for desktop planning sessions.
- **Progressive disclosure:** Show simple options first, reveal advanced fields on demand.
- **Offline indicator:** Clear visual cue when offline + last backup/export timestamp visible in settings.
- **No signup wall:** App works immediately. Optional cloud sync is a setting, not a gate.

### 6.4 Accessibility

- Large tap targets (minimum 44×44px)
- Optional high-contrast theme
- Adjustable font size (at least 2 steps: normal, large)
- Semantic HTML for screen reader support
- Focus management for keyboard navigation on desktop

---

## 7. Build Phases

### Phase 1 — MVP: The Journal Loop (4-6 weeks)

**Goal:** Prove the core loop works and feels joyful. Ship fast, iterate.

**Must ship:**

| Feature | Scope |
|---------|-------|
| Plant Inventory | CRUD with minimal fields (name, species, type, status, photo, source). No Planting split yet — flat model is fine for MVP. |
| Garden Journal | Quick log (photo + text + tag plant) + basic structured entry (activity type). Chronological feed with basic filter (by plant). Virtualized with react-window. |
| Manual Tasks | Create tasks with title, due date, priority. Checkbox completion. Simple list view. |
| Settings | Zone, frost dates, garden name, theme toggle |
| PWA Shell | Installable, offline-capable (Workbox), responsive mobile-first layout |
| Data Export | JSON export of all data + photos as ZIP |
| Dashboard | Upcoming tasks, recent journal entries, "Today in your garden" prompt, quick action buttons |
| Search | MiniSearch for journal + plant names |

**Explicitly deferred from Phase 1:**
- Season entity and PlantInstance/Planting split (add in Phase 2 with migration)
- Seed Bank
- Planting calendar auto-generation
- Garden map canvas
- Weather integration
- Auto-generated tasks / TaskRules
- Recurring tasks
- Notifications
- Advanced filtering and tags (basic filter is enough)

**Phase 1 definition of done:** You (Ahmed) use it daily for a week and it feels joyful. Export works. No data loss.

### Phase 2 — Planning Layer (4-6 weeks after MVP)

| Feature | Scope |
|---------|-------|
| **Season Model** | Introduce Season entity. Migrate flat Plant to PlantInstance + Planting. Dexie version 2 migration. |
| Seed Bank | Full inventory tracking, "planted from seed" flow, expiry indicators |
| Planting Calendar | Auto-computed windows from PlantKnowledge offsets + frost dates, month view |
| Garden Map | Grid canvas (Konva.js), snap-to-grid rectangles, plant placement, bed attributes |
| Task Enhancements | TaskRule system, auto-generated suggestions, recurring tasks, calendar integration |
| Weather Widget | Open-Meteo API, current conditions on dashboard, frost warnings |
| Photo Pipeline | Full image pipeline (thumbnail + display + optional original), storage dashboard |

### Phase 3 — Intelligence & Community (Ongoing)

| Feature | Scope |
|---------|-------|
| Season Layers | Toggle spring/summer/fall views on garden map |
| Year-over-Year | Compare this season to previous — same plant, different outcomes |
| Companion Planting | Warnings on garden map when placing incompatible plants |
| Plant Knowledge Base | Community-contributed JSON plant data, PR workflow, Zod validation |
| Photo Timeline | Auto-assembled per-plant visual timeline from milestones |
| Import from Other Tools | Import support for common formats |
| Push Notifications | Task reminders, frost alerts (where PWA supports it) |
| Cloud Sync | Optional Supabase/PocketBase for multi-device backup |
| Theming | Dark mode, high-contrast mode, customizable accent colors |
| Accessibility | Full a11y audit, ARIA patterns, keyboard shortcuts |

---

## 8. Open Source Strategy

### 8.1 Repository Structure

```
jninty/
├── src/
│   ├── components/       # React components
│   ├── pages/            # Route-level pages
│   ├── hooks/            # Custom React hooks
│   ├── db/
│   │   ├── schema.ts     # Dexie schema + migrations
│   │   ├── repositories/ # Per-entity data access
│   │   └── search.ts     # MiniSearch index management
│   ├── services/         # Business logic
│   │   ├── calendar.ts   # Planting window computation
│   │   ├── taskEngine.ts # Auto-task generation from rules
│   │   ├── photoProcessor.ts  # Image pipeline
│   │   └── exporter.ts   # JSON + ZIP export/import
│   ├── types/            # TypeScript type definitions + Zod schemas
│   ├── validation/       # Zod schemas for all entities
│   └── assets/           # Icons, illustrations, fonts
├── data/
│   └── plants/           # Community-contributed plant knowledge (JSON)
├── public/
│   ├── manifest.json     # PWA manifest
│   └── sw.js             # Service worker (Workbox generated)
├── docs/
│   └── plans/            # Design documents
├── tests/
├── tsconfig.json         # strict: true, noUncheckedIndexedAccess, exactOptionalPropertyTypes
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── README.md
```

### 8.2 Contribution Model

- **Plant data:** Easiest contribution path — add/correct plants in `data/plants/` via PRs. Validated by Zod schemas in CI.
- **Features:** GitHub issues with "good first issue" labels
- **Translations:** i18n support from Phase 2 onward
- **License:** MIT (maximally permissive for open source)

### 8.3 Community Building

- README with clear screenshots and setup instructions
- CONTRIBUTING.md with guidelines
- GitHub Discussions for feature requests and gardening tips
- Showcase real user gardens (with permission) in repo wiki

---

## 9. Success Metrics

For a personal/open-source project, success looks like:

1. **Personal utility:** Ahmed uses it daily during growing season
2. **GitHub stars:** 100+ within first 6 months (indicates community interest)
3. **Contributors:** 5+ people contributing plant data or features within first year
4. **Reliability:** App works flawlessly offline — zero data loss
5. **Speed:** Journal entry logged in under 10 seconds (3-tap goal)
6. **Data safety:** Export tested and working from day one

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scope creep (too many modules) | Delays MVP indefinitely | Strict Phase 1: journal loop + export only |
| IndexedDB corruption / browser eviction | Data loss | Periodic export reminders, storage visibility dashboard, versioned backups |
| IndexedDB storage limits (especially Safari) | Photo-heavy journals hit limits | Photo pipeline with compression + thumbnail-only in feeds + FS API for full-size |
| Photo storage explosion | Unusable on low-storage devices | Thumbnail-first display, optional originals, storage dashboard with "clear originals" |
| PWA notification limits on iOS | Missed task reminders | In-app notification badges, "Today in your garden" prompt on open |
| iOS Safari PWA edge cases | Broken install or offline behavior | Test early on iOS Safari + add-to-homescreen; document limitations in README |
| Garden map complexity | Canvas drawing is hard to get right | Rectangles only, cap rendered elements, lazy-load map route |
| Konva.js mobile performance | Slow on older phones | Limit canvas elements, lazy-load, derived canvas JSON |
| Future sync complexity | Messy conflict resolution later | version + deletedAt on every entity from day one |
| Open source maintenance burden | Burnout | Clear contribution guidelines, automate CI/CD, Zod validation in pipeline |
| MiniSearch index size | Slow startup with thousands of entries | Serialized to IndexedDB, incremental updates, rebuild-from-scratch fallback |

---

## 11. Implementation Checklist

Before writing any code, these decisions and scaffolding should be in place:

- [ ] Initialize Vite + React + TypeScript project with strict tsconfig
- [ ] Set up Tailwind CSS with warm/organic theme tokens
- [ ] Define all Zod schemas in `src/validation/`
- [ ] Set up Dexie with version 1 schema + migration scaffolding
- [ ] Implement photo pipeline (thumbnail + display resize using canvas)
- [ ] Set up MiniSearch with incremental indexing + IndexedDB persistence
- [ ] Implement JSON + ZIP export from day one
- [ ] Set up Workbox via Vite PWA plugin for offline caching
- [ ] Implement virtualized journal feed (react-window) before having 100+ entries
- [ ] Test PWA install + offline on iOS Safari early
- [ ] Ship Phase 1 MVP: journal loop + export + manual tasks
- [ ] Phase 2: Add Season entity + PlantInstance/Planting migration
- [ ] Phase 2: Implement TaskRule engine
- [ ] Phase 2: Build garden map with Konva.js (rectangles only)

---

*This document will be updated as the design evolves through implementation.*
*v2.0 incorporates all recommendations from the Design Review v1.*
