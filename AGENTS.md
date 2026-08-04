# 2040 USA implementation rules

- This repository is the standalone 2040 USA application. It must not share code, infrastructure, environment variables, secrets, or data with any other project.
- The strategy ChatGPT conversation owns product strategy, architecture, and scope decisions.
- Codex implements only the currently approved increment. Do not begin later increments without explicit approval.
- Do not add speculative features, abstractions, integrations, or dependencies.
- Do not create Git commits without explicit instruction.
- Never put secrets, credentials, private keys, or production customer data in source control.
- Report verification results honestly. Include actual failures and do not imply an unrun check passed.
- Generated code must remain understandable, intentionally named, and maintainable by a small product team.
- Increment 2B authorizes private artwork records and direct Uppy/TUS uploads only in project `bcalocreiqbyufnakrnq`. Pricing, submission, payments, accounts, artwork approval, and production administration remain deferred.
- Supabase SQL migrations are the sole schema-migration authority. Never create Prisma migrations or run Prisma Migrate or `prisma db push`.
- Prisma is server-only typed data access. Customer queries must derive ownership from verified Supabase claims and include the owner filter.
- The order draft store must remain scoped to the `/order` layout provider. Zustand remains immediate client state; Postgres is authoritative for durable identity, ownership, versions, and completion invariants.
- Starting-route radio and query choices remain Start-step UI state until explicit version-checked confirmation succeeds. Never autosave a pending route.
- Hydration and Auth verification errors must fail visibly and retryably; never reinterpret an unexpected failure as an absent draft.
- Deployment mode and its public counterpart are required and must fail closed. Trusted production hosting cannot be overridden to development.
- Do not reuse or access another Supabase project. Remote mutation scripts must verify `bcalocreiqbyufnakrnq` before executing.
- Storage paths are server-generated. Never accept owner IDs or object paths from browser input, never upsert customer artwork, and delete objects only through the authenticated Storage API.
- Browser `getSession()` may forward the current access token to Storage but is never authorization evidence; protected APIs use verified claims.
- Preserve accessibility, mobile behavior, and the industrial 2040 USA visual language when changing frontend work.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
