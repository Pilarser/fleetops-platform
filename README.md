# Fleet Mobility Platform

Frontend-first MVP for a legally distinct fleet mobility management product.

## Product Purpose

FleetOS helps companies manage fleet mobility from one operations portal: vehicles, drivers, service access, mobility spend, provider coverage, reporting, and approvals. The web app is for fleet/admin/finance users first; a driver-facing mobile or web app can be added later against the same backend.

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

Demo data is seeded from `src/data/mock-data.ts`. When the local API runs, mutable data is persisted to `server/.data/fleet-db.json`.

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

The API stores mutable demo data in `server/.data/fleet-db.json`. Delete that file to reset to seeded data.

Run backend tests:

```bash
pnpm test:api
```

Backend structure:

```text
server/
  app.ts          Server factory and route dispatch
  auth.ts         Demo sessions and role guards
  http.ts         JSON/CORS/body helpers
  schemas.ts      Zod request validation
  storage.ts      File-backed store
  index.ts        Local API entrypoint
```

## Demo Login

Use one of these accounts:

```text
admin@example.com / demo1234
finance@example.com / demo1234
driver@example.com / demo1234
```

When `VITE_API_URL` is configured, login uses the local API. Without `VITE_API_URL`, the static GitHub Pages demo uses the same demo users locally in the browser.
