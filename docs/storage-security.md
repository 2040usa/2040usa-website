# Storage security

`customer-artwork` is private, limited to 50 MiB, and restricted to the approved MIME list by migration SQL. There are no public object URLs and no ordinary object-update policy.

Storage INSERT requires an authenticated owner, an exact pending/retryable `artwork_files` reservation, the matching owned active draft, and the canonical route. SELECT and DELETE require the object `owner_id` to match `auth.uid()`. Authenticated Data API clients receive owner-scoped SELECT only; INSERT, UPDATE, and DELETE grants and policies are absent. Canonical artwork mutation is server-only through Prisma with a verified owner filter. Cross-owner lookups are treated as not found.

The reservation must also be unexpired. Only `pending`, or `failed` with `failure_code = 'upload_failed'`, can authorize INSERT. Uploaded, deleting, expired, missing-object, size/MIME/verification, and deletion-failure records cannot authorize a transfer; explicit recovery must reconcile them or issue a new ID/path.

The database also checks the exact path assembled from the row: `users/{owner_user_id}/drafts/{draft_id}/artwork/{id}/original.{extension}`. Reservation identity fields are immutable. A replacement target must share owner, draft, and route, cannot point to itself, and cannot be attached or switched after insertion; `ON DELETE SET NULL` remains the one allowed non-null-to-null transition.

Replacement always uses a new artwork ID and path; upsert is disabled. Product deletion first marks the record deleting under the draft advisory lock and revokes acknowledged/validated progress when readiness falls. It then calls the authenticated Storage API for only the exact recorded path and removes the row only after deletion or confirmed absence. SQL never deletes Storage objects. Object-without-record cleanup remains operational work for a later increment.

The browser transport is reservation-specific as well. `@uppy/tus` uses the Uppy file ID in its persisted fingerprint, so the application binds that ID to the server-issued artwork UUID before upload. Identical metadata cannot make a new selection, restart, or replacement resume another record's retained URL. Invalid verified objects are removed through the authenticated exact-path deletion flow and are never overwritten in place.

Route-change and Start Over cleanup have separate preparation and finalization transactions around the external Storage calls. Finalization reacquires the same per-draft advisory lock as reservation and requires zero owner-scoped artwork rows. A reservation created during cleanup blocks finalization and is returned for retry; cleanup success requires both object absence and row absence.

Signed image previews expire after 60 seconds and are not persisted. PDF, AI, and PSD remain generic metadata cards. A preview is never an approval or content-integrity result.
