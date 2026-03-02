# Jninty

A local-first, open-source garden journal and management PWA. All data lives in IndexedDB — no account required, works offline.

## Features

- **Plant Inventory** — Track all your plants with photos, species, care notes, and status
- **Garden Journal** — Log daily garden activities with photos, linked to specific plants
- **Quick Log** — 3-tap photo-first logging workflow
- **Task Management** — Create, prioritize, and track garden tasks with due dates
- **Full-Text Search** — MiniSearch-powered search across plants and journal entries
- **Data Export** — Export all data as a ZIP file for backup
- **PWA** — Install on your device, works offline
- **No account required** — Everything stays on your device

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
git clone <repo-url>
cd jninty
npm install
```

### Development

```bash
npm run dev          # Start Vite dev server
npm run build        # TypeScript type-check + production build
npm run preview      # Preview production build
npm run lint         # ESLint
npm run test         # Run tests (single run)
npm run test:watch   # Run tests (watch mode)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript (strict mode) |
| Build | Vite |
| Styling | Tailwind CSS v4 |
| Database | PouchDB (IndexedDB) + optional CouchDB sync |
| Routing | React Router DOM v7 |
| Search | MiniSearch |
| Validation | Zod |
| Dates | date-fns |
| PWA | vite-plugin-pwa + Workbox |
| Testing | Vitest + Testing Library |

## Architecture

```
src/
  pages/           Route-level page components
  components/      Shared UI components
  components/ui/   Primitive UI (Button, Card, Input, Badge, Toast, Skeleton)
  components/layout/  Layout (AppShell — sidebar + bottom nav)
  db/              PouchDB client, repositories, search index
  hooks/           Custom React hooks
  services/        Business logic (exporter, photo processor, storage)
  validation/      Zod schemas
  types/           TypeScript type definitions
  constants/       Label and option constants
```

All data is stored in IndexedDB via PouchDB, with optional CouchDB replication for multi-device sync. Entities include `id` (UUID), `version`, `createdAt`, `updatedAt`, and `deletedAt` fields.

## Multi-Device Sync (Optional)

Want to sync between your phone and desktop? See [sync/README.md](sync/README.md) — it's one command: `cd sync && ./setup.sh`

## License

MIT
