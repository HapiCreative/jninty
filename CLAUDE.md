# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jninty is a local-first, open-source garden journal and management PWA. All data lives in IndexedDB (via PouchDB) with optional CouchDB sync for multi-device use — no account required, works offline. The full design document is at `docs/plans/Jninty-Design-v1.md`.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # TypeScript type-check + Vite production build
npm run preview      # Preview production build locally
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:watch   # Vitest (watch mode)
npx vitest run src/App.test.tsx  # Run a single test file
```

## Architecture

**Routing:** React Router DOM v7 with BrowserRouter. Route-level pages go in `src/pages/`, shared components in `src/components/`.

**Data layer:** PouchDB v9 wrapping IndexedDB, with optional CouchDB replication for multi-device sync. PouchDB client and helpers live in `src/db/pouchdb/`. Per-entity data access functions go in `src/db/pouchdb/repositories/`. All entities include `id` (UUID), `version`, `createdAt`, `updatedAt`, and `deletedAt` fields. Documents are prefixed with a `docType` (e.g. `plant:uuid`) for type isolation in the single-database model.

**Validation:** Zod schemas in `src/validation/` validate all DB imports, exports, and plant knowledge base data at runtime.

**Search:** MiniSearch provides client-side full-text search. Index is built incrementally on DB writes and serialized to IndexedDB for fast startup. Management code goes in `src/db/search.ts`.

**Business logic:** Pure service functions in `src/services/` (calendar computation, task engine, photo processing, export/import).

**Styling:** Tailwind CSS v4 — configured entirely via CSS in `src/index.css` using `@import "tailwindcss"` and a `@theme` block. There is no `tailwind.config.ts` file. Custom tokens: `green-*` (primary), `cream-*` (backgrounds), `brown-*` (accents), `terracotta-*` (highlights). Display font: `font-display` (Nunito). Body font: `font-sans` (Inter).

**PWA:** `vite-plugin-pwa` with Workbox autoUpdate. Custom `public/manifest.json` (not plugin-generated). Theme color `#2D5016`, background `#FDF6EC`, standalone display.

## TypeScript Strictness

`tsconfig.app.json` enforces `strict: true`, `noUncheckedIndexedAccess: true`, and `exactOptionalPropertyTypes: true`. Array/object index access returns `T | undefined`. Optional properties cannot be assigned `undefined` unless the type explicitly includes it.

## Build Phases

The project ships incrementally. Phase 1 (MVP): Plant Inventory, Garden Journal, Manual Tasks, Settings, PWA shell, data export, Dashboard, MiniSearch. Phase 2 adds Season/Planting split, Seed Bank, Calendar, Garden Map (Konva.js), TaskRules, weather. Phase 3 adds year-over-year comparison, companion planting, cloud sync. See the design doc for full details.
