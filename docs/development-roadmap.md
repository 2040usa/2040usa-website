# Development roadmap
Each increment requires strategy-chat approval.

## Increment 0 — frontend foundation (complete)

- Responsive marketing homepage, tokens, documentation, Vitest, and Playwright

## Increment 1 — client order prototype (complete)

- Four route-specific steps, React Hook Form/Zod validation, layout-scoped Zustand, and Review

## Increment 2A — durable anonymous drafts (current)

- Dedicated hosted Supabase development project
- Anonymous identity only at explicit route confirmation
- Durable working and validated configuration
- RLS plus application owner filters
- Optimistic concurrency, conflict recovery, and canonical Start Over
- Local pending route choice, atomic update-return writes, fail-closed hydration/environment handling, and deterministic Prisma generation
- Additive JSON route hardening migration `20260803000200`
- No artwork, pricing, submission, payment, order, or production workflow

## Increment 2B — artwork foundation (deferred)

Private artwork records, Storage, Uppy/TUS resumable uploads, and image/file inspection are intentionally excluded from 2A.

## Later increments — planned, not authorized

1. Server-owned pricing, capacity decisions, and real order submission
2. Stripe payment lifecycle and reconciliation
3. Resend customer communication
4. Role-protected production operations
5. Privacy-aware analytics and release hardening
