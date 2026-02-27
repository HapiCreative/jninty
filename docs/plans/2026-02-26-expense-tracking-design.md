# Expense Tracking Feature Design

## Overview

Track garden spending across plants, seeds, and standalone expenses (tools, soil, etc.). Generate reports filtered by store, category, season, or date range.

## Data Model

### PlantInstance — new optional fields

- `purchasePrice` — `z.number().nonnegative().optional()` — what you paid
- `purchaseStore` — `z.string().optional()` — where you bought it (e.g. "Home Depot")

### Seed — new optional field

- `purchaseStore` — `z.string().optional()` — store where purchased (distinct from existing `supplier` which is the brand)

### New entity: Expense

Standard base fields: `id` (UUID), `version`, `createdAt`, `updatedAt`, `deletedAt`.

| Field      | Type                  | Required | Notes                                    |
| ---------- | --------------------- | -------- | ---------------------------------------- |
| `name`     | string                | yes      | e.g. "Garden hose", "Potting mix 40L"    |
| `category` | enum                  | yes      | see categories below                     |
| `amount`   | number (non-negative) | yes      | cost in user's local currency            |
| `store`    | string                | no       | auto-suggest from past entries           |
| `date`     | string (ISO date)     | yes      | purchase date                            |
| `seasonId` | string (UUID)         | no       | link to a season for season-based filter |
| `notes`    | string                | no       | freeform notes                           |

**Expense categories (enum):** `tools`, `soil_amendments`, `containers`, `infrastructure`, `fertilizer`, `pest_control`, `other`

DB migration: version 7 adds `expenses` store with indexes on `date`, `category`, `store`, `seasonId`, and `deletedAt`.

## Store Auto-Suggest

- Free-text input that queries all unique store names across `plantInstances.purchaseStore`, `seeds.purchaseStore`, and `expenses.store`
- Case-insensitive matching, sorted by most recently used
- User can always type a new value
- No dedicated store management UI — the list builds from what you've entered
- Implemented as a reusable `StoreAutosuggest` component

## Plant & Seed Form Changes

### PlantFormPage

Add two optional fields after `dateAcquired`:

- **Purchase price** — number input with `$` prefix
- **Purchased at** — `StoreAutosuggest` component

### SeedFormPage

Add one optional field next to existing `cost`:

- **Purchased at** — `StoreAutosuggest` component

## Expenses Page (`/expenses`)

### Top summary area

- **Total spent** for the selected period (prominent number)
- **By category** — horizontal bar chart (CSS-based, no charting library) showing each category's total with distinct colors
- **Top stores** — ranked list of top 5 stores by total spent, showing amount and percentage

All summaries update reactively when filters change.

### Filter bar

- Season picker (dropdown of existing seasons)
- Date range (start + end date inputs)
- Store (auto-suggest, same component)
- Category (multi-select from the fixed list)

### Expense list

- All expenses from three sources merged: Expense entity rows, PlantInstance rows with `purchasePrice`, Seed rows with `cost`
- Sorted by date descending
- Each row: name, category badge, store, amount, date
- Plant/seed rows show category as "Plants" or "Seeds" and link to their detail page
- Plant/seed rows are read-only in this list (edit via their own forms)

### Add expense

- FAB or "Add expense" button navigates to `/expenses/new`
- Edit navigates to `/expenses/:id/edit`

## Expense Form (`/expenses/new`, `/expenses/:id/edit`)

| Field    | Input type             | Required | Default |
| -------- | ---------------------- | -------- | ------- |
| Name     | text                   | yes      | —       |
| Amount   | number with `$` prefix | yes      | —       |
| Category | dropdown (fixed list)  | yes      | —       |
| Store    | StoreAutosuggest       | no       | —       |
| Date     | date picker            | yes     | today   |
| Season   | dropdown (seasons)     | no       | —       |
| Notes    | textarea               | no       | —       |

## Dashboard Widget

New "Spending" card placed after the weather widget:

- **Total spent** for the current active season
- **Category breakdown** — top 2-3 categories with amounts (e.g. "Plants $85 · Tools $42 · Soil $15")
- Tapping the card navigates to `/expenses`
- Empty state: "Track your garden spending" with link to add first expense

## Aggregation Service (`expenseService.ts`)

Pure functions that merge cost data from all three sources:

- `getAllExpenseRows(filters)` — returns unified list from expenses + plants + seeds
- `getTotalSpent(filters)` — sum of all amounts
- `getSpendingByCategory(filters)` — totals grouped by category
- `getSpendingByStore(filters)` — totals grouped by store, sorted descending
- `getAllStoreNames()` — unique store names across all entities for auto-suggest

Filter options: `seasonId`, `startDate`, `endDate`, `store`, `categories[]`

## Files to Create

- `src/validation/expense.schema.ts`
- `src/db/repositories/expenseRepository.ts`
- `src/pages/ExpensesPage.tsx`
- `src/pages/ExpenseFormPage.tsx`
- `src/components/SpendingWidget.tsx`
- `src/components/StoreAutosuggest.tsx`
- `src/services/expenseService.ts`

## Files to Modify

- `src/db/schema.ts` — migration v7
- `src/validation/plantInstance.schema.ts` — add `purchasePrice`, `purchaseStore`
- `src/validation/seed.schema.ts` — add `purchaseStore`
- `src/pages/PlantFormPage.tsx` — add price + store fields
- `src/pages/SeedFormPage.tsx` — add store field
- `src/pages/DashboardPage.tsx` — add SpendingWidget
- `src/App.tsx` or routing config — add `/expenses` routes
- Navigation component — add Expenses link

## Out of Scope

- No currency picker or multi-currency
- No receipt photo attachment
- No recurring expenses
- No budget or goal tracking
- No dedicated expense export (covered by existing full data export)
