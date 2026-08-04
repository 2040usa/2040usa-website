# Upload recovery

Reservations expire after 24 hours. A pending or failed record remains visible after refresh and offers an explicit Resume upload, Reselect file, or Restart expired upload action. The customer chooses that canonical record before selecting local bytes. The request carries its recovery ID; the server verifies owner, draft, route, purpose, fingerprint, normalized name, declared bytes, canonical MIME, and last-modified value. A new file selection never searches by fingerprint, and ambiguous metadata is never guessed.

Pause and resume operate on the current TUS transfer. Retry reuses the reservation and upload URL when safe. Cancel stops the browser transfer and retires the record/object through product APIs; a partially transferred TUS resource may remain until Supabase expires it, so the UI does not claim immediate server-resource destruction.

Reconciliation verifies any object found for a pending or failed row, allowing recovery when Storage completed but the application callback was lost. An unexpired explicit recovery reuses its row and path. An expired recovery reconciles a valid completed object or retires the old row and creates a new identity/path; the former fingerprint uniqueness rule was removed because metadata is not file identity. Missing uploaded objects become `object_missing`; size/MIME mismatches use finite failure codes rather than raw exception text.

Expired and non-retryable failed rows cannot authorize Storage INSERT. Only an unexpired pending row or an unexpired `upload_failed` retry remains transferable. All other states require explicit recovery so the server can reconcile an existing object or create a new path.

Recovery controls follow the canonical lifecycle exactly:

- Unexpired `pending`: **Resume upload** on the same record, path, and TUS identity after exact-file reselection.
- Unexpired `upload_failed`: **Retry upload** on the same identity; the server may reset only this failure to pending.
- Expired pending or `upload_expired`: **Restart expired upload**. A valid completed object is reconciled; otherwise a new record, path, and transport identity are created.
- `object_missing`: **Restart missing upload** on a new record and path.
- `size_mismatch`, `mime_mismatch`, or `verification_failed`: **Remove invalid upload**. The occupied exact object cannot be overwritten; deletion must finish before a later selection creates a new path.
- `deleting` or `deletion_failed`: **Retry delete** only.

Idempotent reservation retries are lifecycle-aware. Uploaded records return no upload metadata, eligible unexpired pending or `upload_failed` records may return their existing path, and expired or non-retryable records never receive unsafe old-path upload metadata.

Route changes and Start Over prepare cleanup in one serializable transaction: all rows become deleting, artwork acknowledgment and validated configuration are revoked, route-compatible working values remain, and the draft version advances once when progress changes. External Storage deletion follows for exact recorded paths. Partial failure keeps the prior route, applies the safe canonical snapshot, and exposes retry without repeating rows already removed.

After external deletion, a second serializable transaction reacquires the per-draft lock and requires zero artwork rows before changing the route or resetting the draft. Concurrent reservations therefore prevent finalization and become visible retry work. A successful object deletion is not considered complete until the exact database row is also proven absent.

Closing a tab before the interface reports a verified result can still interrupt a transfer. A partially retained TUS resource or an object without a canonical record may require later operational cleanup; Increment 2B does not add a bucket-wide sweeper.
