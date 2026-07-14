# Fleet Mobility Platform

Frontend-first MVP for a legally distinct fleet mobility management product.

## Stack

- React 19
- TypeScript
- Vite
- React Router
- TanStack Query, ready for API-backed server state
- TanStack Table dependency included for later advanced tables
- Local shadcn-style component primitives in `src/components/ui.tsx`
- Plain CSS for the first iteration, with an easy path to Tailwind/shadcn CLI later
- Lucide icons

## Phase 1 Scope

The first web MVP focuses on the fleet manager portal:

- Dashboard with spend and operational KPIs
- Vehicle list
- Driver list
- Unified transaction ledger
- Mobility service catalog
- Provider coverage preview
- Monthly reporting view

All data is currently seeded in `src/data/mock-data.ts`. This keeps the UI productive while the backend API and real integrations are designed.

## Suggested Architecture

```text
fleet/
  src/
    components/       App shell and reusable UI primitives
    data/             Mock data and formatting helpers
    pages/            Route-level feature screens
    types.ts          Shared domain model
```

Future backend/mobile structure:

```text
fleet/
  apps/
    web/
    api/
    mobile/
  packages/
    shared/
    ui/
```

This repo starts as a single Vite app to keep Phase 1 simple. Once the API starts, migrate to the monorepo layout above.

## Run Locally

```bash
pnpm install
pnpm dev
```

The Vite dev server is configured for port `5174`.

## Run With The Local API

Start the backend in one terminal:

```bash
pnpm api
```

Start the frontend in another terminal:

```bash
VITE_API_URL=http://127.0.0.1:4000/api pnpm dev
```

The API currently stores data in memory. Restarting `pnpm api` resets the demo data.
