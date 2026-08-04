# Durable drafts

`public.order_drafts` contains one active row per Auth owner. Structural constraints enforce route values, lifecycle order, JSON object shape, route-key presence/type/equality, positive versions, and timestamp updates.

The selected radio and homepage query are pending Start-step UI state, not canonical draft state. A valid query has precedence over the hydrated canonical route, but neither path autosaves. Only successful confirmation changes the durable route.

Route confirmation uses the same serialized mutation coordinator as autosave, explicit flush, reset, and Reload latest. For an existing draft it cancels the debounce, waits for an in-flight write, flushes every dirty canonical value, rereads the store, and uses the latest returned version. A same-route confirmation then navigates without another request or canonical rehydration, preserving recent working and validated values. A different-route confirmation clears incompatible state only through its successful version-checked server result. A failed flush or conflict prevents the route mutation, and an older autosave response cannot arrive after the route change.

The server derives ownership from verified claims and completion from canonical fields. `updateManyAndReturn` checks owner, ID, active status, and version and returns the row produced by that statement. Success increments once. A stale request returns `VERSION_CONFLICT`/409 without overwrite.

Working configuration mirrors controls and may be temporarily invalid. Completed configuration passes the strict route-specific Zod schema and alone permits Review.

Hydration distinguishes a durable draft, a genuine empty result, Auth verification failure, backend failure, and malformed response. Unknown state keeps guarded content closed and exposes Retry; it is never converted into an empty draft.

Typing autosaves through a serialized debounce. Artwork acknowledgment and validated Project Details explicitly flush before advancing, so Review is durable before it appears. Exit Order attempts the same flush and stays put on failure. Closing a tab during a pending debounce can still lose changes, but Saved has not been claimed then.

Start Over preserves the row ID, clears all progress/configuration, increments the version, and applies the returned canonical reset before local navigation. Anonymous Auth cleanup remains a later operational concern.
