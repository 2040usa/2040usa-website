# Gang-sheet order-draft workflow

Increment 3B stores a prototype gang-sheet draft and private artwork, not a customer order. It does not price, reserve production capacity, approve artwork, submit work, or take payment.

1. **Starting point:** exactly two semantic route cards are active: Print-Ready Gang Sheet and Individual Designs. A query may highlight a card but cannot create a draft. Deliberate card activation creates or reuses an anonymous session, durably confirms the route, and navigates only after success. Changing a populated route retains the guarded destructive confirmation and cleanup.
2. **Artwork:** route-specific files upload directly to private Storage through TUS. Only canonical uploaded records that pass server object verification satisfy readiness; acknowledgment is versioned before navigation.
3. **Project details:** a print-ready gang sheet retains copies, finished dimensions, and notes. Every uploaded Individual Designs artwork UUID owns one configuration card with stable size variants, quantity, and optional requested-change instructions. Each variant stores exactly one of width, height, or original-size intent; no independently editable width/height pair exists.
4. **Review:** strict Zod validation succeeds, the completed configuration flushes, and only then navigation occurs. Immediate refresh restores Review.

Zustand remains layout-scoped and immediate. Postgres is canonical for ownership, fields, and version. Hydration errors remain unknown/retryable rather than empty.

Every write is serialized and versioned. Draft-sensitive artwork operations use the flush-before-mutation boundary, so queued Project Details saves finish before acknowledgment, reconciliation, readiness-revoking deletion, route cleanup, or Start Over reads a version. Atomic update-return semantics prevent a later writer from changing an earlier response. Stale writes show Conflict detected and require Reload Latest. Exit Order attempts to flush. Tab termination during a pending debounce remains a limitation, and Saved is never shown before success.

New verified individual-design artwork initializes incomplete working configuration and revokes an obsolete completed configuration. Deletion prunes its linked configuration. Verified replacement rebinds the old artwork UUID to the new canonical UUID before old-object cleanup, preserving sizes and requested changes.

Each design supports up to 20 stable size variants. Requested dimensions must be greater than zero and no more than 1,000 inches; quantities must be whole numbers from 1 through 10,000. These draft validation bounds are safeguards, not production acceptance or pricing promises.

Start Over prepares artwork cleanup and revokes progress before external deletion, then resets the server row only after every recorded object and row is gone. Partial cleanup retains the previous route and exposes retry. Pricing, submission, orders, quality-review outcomes, preparation fees, and payments remain deferred.
