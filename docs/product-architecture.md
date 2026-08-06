# Product architecture

## Current increment: consolidated gang-sheet drafts

Increment 3B keeps the four-step workflow and one anonymously owned durable draft while consolidating the active product model to gang-sheet and individual-designs. Marketing and Start browsing perform no sign-in. Query highlighting is non-durable; deliberate route-card activation is the first durable route boundary.

The `/order` layout creates one vanilla Zustand store through React context. Zustand keeps typing/navigation immediate; Postgres owns identity, ownership, version, and completion invariants. Hydration restores canonical state before guards expose protected content. Failures remain retryable errors rather than empty drafts.

Working configuration may contain blank or invalid strings. Completed configuration remains the strict Zod union and alone unlocks Review. Individual Designs configuration is keyed by canonical artwork UUID and contains one or more stable, discriminated width/height/original variants. Server persistence validates the complete owner-scoped canonical artwork set. Important navigation boundaries flush through the serialized persistence queue.

## Backend boundaries

- Dedicated project: `bcalocreiqbyufnakrnq` (`2040usa-development`, `us-west-1`).
- Supabase SQL migrations are the sole schema authority; 20260806000100 forward-migrates legacy routes and purposes without rewriting the five historical migrations or changing Storage paths.
- Prisma 7 with the PostgreSQL adapter is server-only; prebuild deterministically regenerates its ignored client.
- Every repository operation includes the verified owner. RLS separately applies `auth.uid()` ownership.
- Atomic update-return operations check owner, ID, status, and expected version in one statement.
- Cookie-authenticated mutations require origin, body, UUID, schema, no-store, and version controls.
- Required matching deployment modes fail closed; trusted production hosting forces production protections.
- Hosted tests create exactly two identified users and never guess recent identities.

Increment 2B adds canonical artwork metadata in Postgres and private bytes in Supabase Storage. The browser transfers directly with headless Uppy/TUS after a server reservation. Protected APIs reserve, verify completion, reconcile, acknowledge readiness, preview, and delete. Zustand remains immediate draft state, the artwork provider owns canonical metadata, and Uppy alone owns ephemeral `File` and progress state.

There are still no prices, real orders, payments, accounts, staff approvals, quality-review outcomes, deep file inspection, or production controls.
