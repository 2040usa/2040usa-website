# Product architecture

## Current increment: durable anonymous drafts

Increment 2A keeps the four-step workflow and adds one anonymously owned durable draft. Marketing and Start browsing perform no sign-in. Pending route selection is Start-step UI state. Explicit version-checked confirmation is the first durable route boundary.

The `/order` layout creates one vanilla Zustand store through React context. Zustand keeps typing/navigation immediate; Postgres owns identity, ownership, version, and completion invariants. Hydration restores canonical state before guards expose protected content. Failures remain retryable errors rather than empty drafts.

Working configuration may contain blank or invalid strings. Completed configuration remains the strict Zod union and alone unlocks Review. Important navigation boundaries flush through the serialized persistence queue.

## Backend boundaries

- Dedicated project: `bcalocreiqbyufnakrnq` (`2040usa-development`, `us-west-1`).
- Supabase SQL migrations are the sole schema authority; `20260803000200` hardens JSON routes without rewriting `20260803000100`.
- Prisma 7 with the PostgreSQL adapter is server-only; prebuild deterministically regenerates its ignored client.
- Every repository operation includes the verified owner. RLS separately applies `auth.uid()` ownership.
- Atomic update-return operations check owner, ID, status, and expected version in one statement.
- Cookie-authenticated mutations require origin, body, UUID, schema, no-store, and version controls.
- Required matching deployment modes fail closed; trusted production hosting forces production protections.
- Hosted tests create exactly two identified users and never guess recent identities.

There are no artwork records, Storage buckets, uploads, prices, real orders, payments, accounts, or production controls. Increment 2B remains deferred.
