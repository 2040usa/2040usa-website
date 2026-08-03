# Development roadmap

Each increment requires explicit strategy-chat approval. Sequence and scope may change after review.

## Increment 0 — frontend foundation (complete)

- Responsive static marketing homepage
- Small reusable UI foundation and centralized tokens
- Static customer-order and production-dashboard demonstrations
- Strict TypeScript, ESLint, Vitest, and Playwright foundation
- Architecture and implementation documentation

## Increment 1 — client-side order prototype (current)

- Persistent App Router order layout with real step URLs
- Four starting routes and route-specific artwork guidance
- React Hook Form and Zod project-detail validation
- Layout-scoped, in-memory Zustand draft with Back/Forward support
- Read-only review and deliberate start-over behavior
- No uploads, persistence, pricing, submission, payment, account, or production administration

## Future increments — planned, not authorized

1. **Anonymous draft and artwork foundation:** approved database model, anonymous identity, private artwork records, resumable uploads, and server-side validation.
2. **Server-owned pricing and submission:** durable configurations, authoritative pricing rules, capacity decisions, and real order creation.
3. **Payments:** Stripe Payment Element, idempotent webhook processing, reconciliation, and recovery.
4. **Customer communication:** Resend transactional messages and status visibility.
5. **Production operations:** role-protected internal queue, artwork review, print/cure/QC/pickup states, and audit history.
6. **Protection and insights:** Cloudflare Turnstile and privacy-aware PostHog instrumentation.
7. **Release hardening:** expanded integration coverage, critical journeys, observability, backup/recovery exercises, and Vercel deployment controls.

The roadmap does not authorize speculative UI, fake backend behavior, or early installation of future services.
