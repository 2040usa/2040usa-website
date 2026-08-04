# Authentication and security

Opening marketing pages or `/order/start` creates no identity. Query/radio selection stays local and cannot alter or clear a canonical draft. Identity begins only after Turnstile and explicit confirmation.

The browser uses only the project URL, publishable key, deployment mode, and Turnstile site key. It never receives database credentials, CLI tokens, database passwords, secret keys, or service-role keys.

The browser may use `getSession()` only to determine whether local session material exists. If material exists but `getClaims()` fails, the UI reports a retryable error and cannot create a replacement identity. Server authorization still uses `getClaims()` and validates its subject as a UUID. Browser owner IDs are never authority. Prisma owner filters and forced RLS independently enforce ownership.

State-changing APIs require same-origin requests, bounded bodies, UUID parameters, strict Zod schemas, no-store responses, and optimistic versions. Cross-owner access is generic not-found. Runtime paths do not log tokens or draft bodies.

Server and public deployment modes are required and must agree. Missing or unknown modes fail. Trusted production hosting forces production behavior. Production rejects both the development project and Cloudflare's always-pass key. No production deployment is configured or claimed.

## Artwork authorization boundary

Increment 2B continues to authorize application APIs with `getClaims()`. The browser calls `getSession()` only inside the TUS request hook to forward a current access token to Storage; that token is not identity evidence and is never logged or stored in application state. Storage RLS, table RLS, and server owner filters each enforce ownership. The browser never supplies an owner ID or canonical path, and no secret/service-role key is used.

Authenticated Data API access to `artwork_files` is owner-scoped SELECT only. INSERT, UPDATE, and DELETE grants and policies are absent, so canonical reservation, lifecycle, recovery, and deletion mutations pass exclusively through verified application APIs and the server-only Prisma repository. Storage INSERT remains possible only for an exact server-created reservation visible through the SELECT policy.
