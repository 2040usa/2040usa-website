# 2040 USA implementation rules

- This repository is the standalone 2040 USA application. It must not share code, infrastructure, environment variables, secrets, or data with any other project.
- The strategy ChatGPT conversation owns product strategy, architecture, and scope decisions.
- Codex implements only the currently approved increment. Do not begin later increments without explicit approval.
- Do not add speculative features, abstractions, integrations, or dependencies.
- Do not create Git commits without explicit instruction.
- Never put secrets, credentials, private keys, or production customer data in source control.
- Report verification results honestly. Include actual failures and do not imply an unrun check passed.
- Generated code must remain understandable, intentionally named, and maintainable by a small product team.
- Backend and commerce integrations are intentionally deferred. Do not add Supabase, Prisma, authentication, storage, Stripe, Resend, PostHog, customer-account, admin, database, or API-route implementation until its increment is approved.
- Preserve accessibility, mobile behavior, and the industrial 2040 USA visual language when changing frontend work.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
