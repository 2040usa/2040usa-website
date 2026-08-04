# Durable order-draft workflow

Increment 2A stores a prototype project draft, not a customer order. It does not accept artwork, price, reserve capacity, submit work, or take payment.

1. **Starting point:** query and radio selection are pending UI state. They cannot autosave, clear canonical progress, or increment a version. Confirmation creates or reuses an anonymous session and atomically changes an existing route with its current version.
2. **Artwork:** route-specific guidance is acknowledged and flushed before navigation; there is no file input.
3. **Project details:** raw working values debounce to the server, including invalid values and stable row IDs.
4. **Review:** strict Zod validation succeeds, the completed configuration flushes, and only then navigation occurs. Immediate refresh restores Review.

Zustand remains layout-scoped and immediate. Postgres is canonical for ownership, fields, and version. Hydration errors remain unknown/retryable rather than empty.

Every write is serialized and versioned. Atomic update-return semantics prevent a later writer from changing an earlier response. Stale writes show Conflict detected and require Reload Latest. Exit Order attempts to flush. Tab termination during a pending debounce remains a limitation, and Saved is never shown before success.

Start Over resets the server row first and then applies the canonical empty result. Increment 2B artwork work remains deferred.
