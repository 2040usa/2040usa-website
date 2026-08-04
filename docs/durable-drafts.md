# Durable drafts

`public.order_drafts` contains one active row per Auth owner. Structural constraints enforce route values, lifecycle order, JSON object shape, route-key presence/type/equality, positive versions, and timestamp updates.

The selected radio and homepage query are pending Start-step UI state, not canonical draft state. A valid query has precedence over the hydrated canonical route, but neither path autosaves. Only successful confirmation changes the durable route.

Route confirmation uses the same serialized mutation coordinator as autosave, explicit flush, reset, and Reload latest. For an existing draft it cancels the debounce, waits for an in-flight write, flushes every dirty canonical value, rereads the store, and uses the latest returned version. A same-route confirmation then navigates without another request or canonical rehydration, preserving recent working and validated values. A different-route confirmation clears incompatible state only through its successful version-checked server result. A failed flush or conflict prevents the route mutation, and an older autosave response cannot arrive after the route change.

The server derives ownership from verified claims and completion from canonical fields. `updateManyAndReturn` checks owner, ID, active status, and version and returns the row produced by that statement. Success increments once. A stale request returns `VERSION_CONFLICT`/409 without overwrite.

Working configuration mirrors controls and may be temporarily invalid. Completed configuration passes the strict route-specific Zod schema and alone permits Review.

Hydration distinguishes a durable draft, a genuine empty result, Auth verification failure, backend failure, and malformed response. Unknown state keeps guarded content closed and exposes Retry; it is never converted into an empty draft.

Typing autosaves through a serialized debounce. Increment 2B replaces informational acknowledgment with server-derived artwork readiness. `runAfterDraftFlush` cancels the debounce, awaits queued work, flushes dirty canonical values, rereads Zustand, and passes the latest draft ID/version to acknowledgment, readiness-revoking removal/reconciliation, route cleanup, and Start Over. No artwork operation captures a version before that boundary. Exit Order attempts the same flush and stays put on failure. Closing a tab during a pending debounce can still lose changes, but Saved has not been claimed then.

Route changes and Start Over first serialize draft writes and prepare cleanup under the same per-draft advisory lock. Preparation marks all records deleting and revokes acknowledged/validated progress before any external Storage call. Exact owner-scoped objects and rows are then removed before route change/reset uses the post-preparation version. Partial cleanup keeps the prior route, applies the canonical revoked state, and remains retryable. Anonymous Auth cleanup remains a later operational concern.

Final route mutation/reset occurs in a second serializable transaction that reacquires the lock and requires zero artwork rows. A reservation appearing during external cleanup blocks finalization with `ARTWORK_CLEANUP_INCOMPLETE`. Reconciliation and acknowledgment also remain bound to the caller's submitted expected version; stale requests cannot substitute or acknowledge a newer draft.
