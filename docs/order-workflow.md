# Durable order-draft workflow

Increment 2B stores a prototype project draft and private artwork, not a customer order. It does not price, reserve production capacity, approve artwork, submit work, or take payment.

1. **Starting point:** query and radio selection are pending UI state. They cannot autosave, clear canonical progress, or increment a version. Confirmation creates or reuses an anonymous session and atomically changes an existing route with its current version.
2. **Artwork:** route-specific files upload directly to private Storage through TUS. Only canonical uploaded records that pass server object verification satisfy readiness; acknowledgment is versioned before navigation.
3. **Project details:** raw working values debounce to the server, including invalid values and stable row IDs.
4. **Review:** strict Zod validation succeeds, the completed configuration flushes, and only then navigation occurs. Immediate refresh restores Review.

Zustand remains layout-scoped and immediate. Postgres is canonical for ownership, fields, and version. Hydration errors remain unknown/retryable rather than empty.

Every write is serialized and versioned. Draft-sensitive artwork operations use the flush-before-mutation boundary, so queued Project Details saves finish before acknowledgment, reconciliation, readiness-revoking deletion, route cleanup, or Start Over reads a version. Atomic update-return semantics prevent a later writer from changing an earlier response. Stale writes show Conflict detected and require Reload Latest. Exit Order attempts to flush. Tab termination during a pending debounce remains a limitation, and Saved is never shown before success.

Start Over prepares artwork cleanup and revokes progress before external deletion, then resets the server row only after every recorded object and row is gone. Partial cleanup retains the previous route and exposes retry. Increment 2B remains an uncommitted development increment; pricing, submission, orders, and payments remain deferred.
