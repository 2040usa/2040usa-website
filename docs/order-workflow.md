# Gang-sheet order-draft workflow

Increment 3B stores a prototype gang-sheet draft and private artwork, not a customer order. It does not price, reserve production capacity, approve artwork, submit work, or take payment.

1. **Starting point:** exactly two semantic route cards are active: Print-Ready Gang Sheet and Individual Designs. A query may highlight a card but cannot create a draft. Deliberate card activation creates or reuses an anonymous session, durably confirms the route, and navigates only after success. Changing a populated route retains the guarded destructive confirmation and cleanup.
2. **Artwork & Layout:** `/order/artwork` is the one editable workspace for automatic private uploads, canonical previews, and artwork-linked configuration. Every uploaded artwork UUID owns one compact configuration card. Each Print-Ready Gang Sheet file owns finished width, finished length, and copies; its actual raster file appears independently in the layout preview. Each Individual Designs file owns stable size variants, quantity, and optional requested-change instructions. Its preview panel is a truthful request summary only and does not arrange artwork, calculate sheet length, or claim optimized packing.
3. **Review:** local form validation succeeds, pending working values flush, canonical artwork is durably acknowledged when needed, strict completed configuration flushes, and only then navigation occurs. Immediate refresh restores Review. Review has one **Edit Artwork & Layout** link back to `/order/artwork`.

`/order/configure` is compatibility-only and redirects to `/order/artwork`, so old bookmarks and history entries cannot create a second editable workflow.

The responsive workspace owns a dedicated layout-preview component boundary. Print-Ready Gang Sheet renders each actual uploaded raster independently with `object-contain` and its matching width, length, and copies. Individual Designs currently renders thumbnails, requested sizes, transfer totals when quantities are calculable, and completeness only. It explicitly does not implement or simulate packing; Increment 3B.2B can replace this boundary with deterministic layout output later.

Zustand remains layout-scoped and immediate. Postgres is canonical for ownership, fields, and version. Hydration errors remain unknown/retryable rather than empty.

Every write is serialized and versioned. Draft-sensitive artwork operations use the flush-before-mutation boundary, so queued Artwork & Layout saves finish before acknowledgment, reconciliation, readiness-revoking deletion, route cleanup, or Start Over reads a version. Atomic update-return semantics prevent a later writer from changing an earlier response. Stale writes show Conflict detected and require Reload Latest. Exit Order attempts to flush. Tab termination during a pending debounce remains a limitation, and Saved is never shown before success.

New verified artwork initializes incomplete route-specific working configuration and revokes obsolete completed configuration. Deletion prunes its linked configuration. Verified replacement rebinds the old artwork UUID to the new canonical UUID before old-object cleanup, preserving design sizes/changes or gang-sheet dimensions/copies.

Each design supports up to 20 stable size variants. Requested dimensions must be greater than zero and no more than 1,000 inches; quantities must be whole numbers from 1 through 10,000. These draft validation bounds are safeguards, not production acceptance or pricing promises.

Start Over prepares artwork cleanup and revokes progress before external deletion, then resets the server row only after every recorded object and row is gone. Partial cleanup retains the previous route and exposes retry. Pricing, submission, orders, quality-review outcomes, preparation fees, and payments remain deferred.
