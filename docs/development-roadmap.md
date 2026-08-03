# Development roadmap

Each increment requires explicit strategy-chat approval. Sequence and scope may change after review.

## Increment 0 — frontend foundation (current)

- Responsive static marketing homepage
- Small reusable UI foundation and centralized tokens
- Static customer-order and production-dashboard demonstrations
- Strict TypeScript, ESLint, Vitest, and Playwright foundation
- Architecture and implementation documentation

## Future increments — planned, not authorized

1. **Domain and data foundation:** approved database model, Supabase PostgreSQL, and Prisma migrations.
2. **Identity:** anonymous guest identities and carefully scoped Supabase Auth conversion.
3. **Private artwork intake:** Supabase private Storage plus Uppy/TUS resumable uploads and server-side validation.
4. **Ordering:** real project configuration, durable drafts, pricing rules, capacity decisions, and submission lifecycle.
5. **Payments:** Stripe Payment Element, idempotent webhook processing, reconciliation, and recovery.
6. **Customer communication:** Resend transactional messages and status visibility.
7. **Production operations:** role-protected internal queue, artwork review, print/cure/QC/pickup states, and audit history.
8. **Protection and insights:** Cloudflare Turnstile and privacy-aware PostHog instrumentation.
9. **Release hardening:** expanded Vitest integration coverage, Playwright critical journeys, observability, backup/recovery exercises, and Vercel deployment controls.

The roadmap does not authorize speculative UI, fake backend behavior, or early installation of future services.
