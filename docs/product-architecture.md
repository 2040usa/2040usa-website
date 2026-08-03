# Product architecture

## Current increment: interactive order prototype

Increment 0 established the static Next.js App Router foundation and approved homepage. Increment 1 adds a client-side order workflow across `/order/start`, `/order/artwork`, `/order/configure`, and `/order/review`.

The order layout creates one vanilla Zustand store instance through a React context provider. Because Next.js preserves the shared layout during client navigation, the draft survives route changes and browser Back/Forward within the order experience. A refresh creates a new store and may return a later route to the earliest incomplete step. The store is deliberately not module-global and is not persisted to local storage, cookies, URL payloads, or a server.

Project Details has separate working and completed configuration records. The route-discriminated working record mirrors current form controls—including temporarily incomplete values—so client-side navigation can restore them without claiming the step is complete. The completed record retains the strict `OrderConfiguration` type and is written only after Zod validation succeeds. Navigation guards and Review consult only the completed record. Route changes and Start Over clear both records; a full refresh still clears the entire prototype.

React Hook Form owns active form state and synchronizes its raw working values to the layout store. Route-specific Zod schemas transform numeric control strings and validate the discriminated completed configuration before Review can use it. Navigation guards are client-side because completeness depends on layout-scoped memory. They subscribe only to route, confirmation, artwork acknowledgment, and completed configuration, and redirect only attempts to move beyond the earliest incomplete step.

There are still no API routes, server actions, database writes, identity, uploads, pricing, payments, analytics, or transactional messages. Homepage dashboard panels remain marketing demonstrations.

The project is standalone. It will not reuse another project’s services, data, environment variables, or infrastructure.

## Planned future stack — not installed

The following choices record direction for future, separately approved increments. They are not dependencies or active services today.

- **Supabase:** PostgreSQL, Auth, and private Storage.
- **Prisma ORM:** typed database access and controlled migrations against Supabase PostgreSQL.
- **Anonymous guest customer identities:** durable guest workflow before optional account conversion.
- **Uppy with TUS:** resumable, observable uploads into private storage.
- **Stripe Payment Element and webhooks:** payment collection and authoritative payment lifecycle events.
- **Resend:** transactional production and customer email.
- **Cloudflare Turnstile:** abuse protection on public workflows.
- **PostHog:** product analytics with an explicit privacy and consent policy.
- **Vitest:** unit and integration tests (unit testing begins in Increment 0).
- **Playwright:** browser-level critical-flow coverage (smoke testing begins in Increment 0).
- **Vercel:** application deployment and preview environments.

## Intended boundaries

- Marketing surfaces explain capability and route customers into an order experience.
- Customer workflows collect prototype project requirements without exposing internal production controls or claiming to create an order.
- Production workflows use canonical job state and an audit trail rather than presentation-only status.
- Provider integrations sit behind application-owned adapters so webhook and retry behavior remains testable.
- Private customer artwork is never served as a public asset.

These are architecture constraints, not authorization to implement later increments.
