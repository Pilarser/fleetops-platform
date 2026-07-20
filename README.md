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
- Prisma 7
- Supabase Auth for hosted identity and refreshable sessions
- Supabase Postgres for hosted persistence
- Postgres via Docker for isolated local backend development

## Phase 1 Scope

The first web MVP focuses on the fleet manager portal:

- Dashboard with spend and operational KPIs
- Vehicle list
- Driver list
- Unified transaction ledger
- Mobility service catalog
- Provider coverage preview
- Monthly reporting view

Demo data is seeded from `src/data/mock-data.ts` into Postgres for local backend development.

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

Start Postgres:

```bash
docker compose up -d
```

Apply migrations and seed demo data:

```bash
pnpm exec prisma migrate dev
pnpm exec tsx prisma/seed.ts
```

Start the backend in one terminal:

```bash
pnpm api
```

Start the frontend in another terminal:

```bash
VITE_API_URL=http://127.0.0.1:4000/api pnpm dev
```

The API stores mutable demo data in the local Postgres database. To reset local data:

```bash
pnpm exec prisma migrate reset
pnpm exec tsx prisma/seed.ts
```

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
  prisma.ts       Shared Prisma client
  prisma-store.ts Prisma-backed workspace store
  schemas.ts      Zod request validation
  storage.ts      File-backed store used by isolated API tests
  index.ts        Local API entrypoint
```

## Demo Login

Use one of these accounts:

```text
admin@example.com / demo1234
finance@example.com / demo1234
driver@example.com / demo1234
```

When `VITE_API_URL` points to the hosted Edge API and the Supabase frontend variables are configured, login uses persistent Supabase Auth sessions. Existing demo accounts migrate automatically on their first successful hosted login. Without `VITE_API_URL`, the app uses the same demo users locally in the browser.
