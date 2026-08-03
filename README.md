# 2040 USA

Standalone marketing, ordering, and production-management application for 2040 USA, a DTF printing business in Downtown Los Angeles.

Increment 1 adds a real, client-side ordering prototype at `/order/start`. Visitors can choose a starting route, review artwork guidance, enter validated project details, and review an in-memory draft. In-progress form values survive internal order navigation, while only a separately validated completed configuration can unlock Review. A full refresh still clears the prototype. It does not connect to a database, accept files, authenticate users, calculate prices, create orders, or take payment.

## Requirements

- Node.js 24 or newer
- npm 11 or newer

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

## Technology

- Next.js 16 App Router, React, strict TypeScript
- Tailwind CSS 4 with centralized CSS tokens
- Motion for reduced-motion-aware section reveals
- Lucide React for interface icons
- React Hook Form and Zod for accessible route-specific project forms
- A layout-scoped vanilla Zustand store for temporary, in-memory draft state
- Vitest and Playwright for focused automated coverage

No external imagery is hotlinked. The production-style artwork and registration panels are code-native placeholders intended to be replaced with approved 2040 USA photography or video later.

## Typography

The display stack uses locally available condensed industrial faces: Arial Narrow, then Roboto Condensed or Impact as fallbacks. The body stack prioritizes locally available Inter and standard system sans-serif faces. This avoids a build-time font download while keeping text fast and private; licensed brand font files can later be self-hosted through `next/font/local`.

See [product architecture](docs/product-architecture.md), [design system](docs/design-system.md), and [development roadmap](docs/development-roadmap.md) for project decisions.

The [order workflow](docs/order-workflow.md) documents the four prototype routes, navigation rules, validation boundaries, and future backend seams.
