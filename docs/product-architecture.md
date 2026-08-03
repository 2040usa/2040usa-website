# Product architecture

## Current increment: frontend foundation

Increment 0 is a static Next.js App Router application. Server Components are the default; the only client boundary is the narrowly scoped Motion reveal wrapper. Homepage data lives in a pure configuration module so sequencing and approved labels can be tested without a browser.

There are no API routes, server actions, persistence, identity, uploads, payments, analytics, or transactional messages. Customer ordering and production dashboard screens on the homepage are marketing demonstrations only.

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
- Customer workflows collect project requirements without exposing internal production controls.
- Production workflows use canonical job state and an audit trail rather than presentation-only status.
- Provider integrations sit behind application-owned adapters so webhook and retry behavior remains testable.
- Private customer artwork is never served as a public asset.

These are architecture constraints, not authorization to implement later increments.
