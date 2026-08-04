# 2040 USA

Standalone marketing, ordering, and production-management application for 2040 USA, a DTF printing business in Downtown Los Angeles.

Increment 2B adds privately owned artwork records and authenticated resumable uploads to the durable draft at `/order/start`. Browsing remains anonymous until route confirmation. Saved project details and completed artwork metadata survive refresh; no real order is created.

## Requirements

- Node.js 24 or newer
- npm 11 or newer
- Private access to the dedicated `2040usa-development` Supabase project

## Local development

```bash
npm install
npm run prisma:generate
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run test:hosted
npx playwright install chromium
npm run test:e2e
npm run build
```

`APP_DEPLOYMENT_ENV` and `NEXT_PUBLIC_APP_DEPLOYMENT_ENV` are required and must agree. `npm run build` generates the ignored Prisma client first, so deployment does not depend on stale local output.

## Technology

- Next.js 16 App Router, React, strict TypeScript
- Tailwind CSS 4 with centralized CSS tokens
- Motion for reduced-motion-aware section reveals
- Lucide React for interface icons
- React Hook Form and Zod for accessible route-specific project forms
- A layout-scoped vanilla Zustand store for immediate interactive draft state
- Supabase Auth/Postgres for anonymous durable ownership and persistence
- Prisma 7 with the PostgreSQL driver adapter for server-only typed access
- Uppy 5 with TUS for headless, resumable browser-to-private-Storage uploads
- Vitest and Playwright for focused automated coverage

No external imagery is hotlinked. The production-style artwork and registration panels are code-native placeholders intended to be replaced with approved 2040 USA photography or video later.

## Typography

The display stack uses locally available condensed industrial faces: Arial Narrow, then Roboto Condensed or Impact as fallbacks. The body stack prioritizes locally available Inter and standard system sans-serif faces. This avoids a build-time font download while keeping text fast and private; licensed brand font files can later be self-hosted through `next/font/local`.

See [product architecture](docs/product-architecture.md), [design system](docs/design-system.md), and [development roadmap](docs/development-roadmap.md) for project decisions.

The [order workflow](docs/order-workflow.md), [backend guide](docs/backend-development.md), [durable-draft contract](docs/durable-drafts.md), and [artwork upload guide](docs/artwork-uploads.md) document the workflow and security boundaries.
