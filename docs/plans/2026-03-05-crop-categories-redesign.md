# Crop Categories Redesign

## Problem

The crop picker uses botanical family names (Amaranthaceae, Solanaceae, Apiaceae...) as top-level categories. These are scientifically accurate but unfamiliar to most gardeners. Seed catalogs and garden apps universally use human-friendly categories like Vegetables, Herbs, Flowers, Fruits.

## Solution

Replace botanical family categories with human-friendly plant type categories. Preserve botanical family names in a new `family` field for future crop rotation features.

## Data Model

```typescript
interface CropRecord {
  id: string;
  category: string;    // "Vegetable" | "Herb" | "Flower" | "Fruit"
  family: string;      // "Solanaceae" (botanical family, for crop rotation)
  commonName: string;
  varieties: CropVariety[];
}
```

- `category` changes from botanical family to plant type
- New `family` field preserves old botanical family value
- Custom crops: `family` is optional

## UI Changes

- Crop picker shows 4 top-level categories: Vegetables, Herbs, Flowers, Fruits (fixed order)
- Crops listed alphabetically by common name within each category
- Variety selection step unchanged
- Search gains `family` as searchable field (users who know botanical names can still find crops)

## Files Changed

**Data (4):** `src/data/cropdb/{vegetables,herbs,flowers,fruits}.json` — category → plant type, old value → family
**Types (2):** `cropdb.types.ts` — add family; `customCrop.schema.ts` — add optional family
**Search (1):** `cropDBSearch.ts` — add family to searchable fields
**UI (2):** `CropPicker.tsx`, `StepSelectCrop.tsx` — fixed category order
**Hook (1):** `useCropDB.ts` — fixed display order for categories
**Tests:** update references to old category names
