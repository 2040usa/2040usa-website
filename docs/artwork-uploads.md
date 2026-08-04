# Artwork uploads

Increment 2B reserves an owner-scoped `artwork_files` row immediately before transfer. The server validates the confirmed draft route, purpose, display name, extension, canonical MIME, declared size, count, byte cap, recovery fingerprint, and idempotency key. It generates `users/{owner}/drafts/{draft}/artwork/{artwork}/original.{extension}`; the browser cannot supply or alter that path.

Uppy owns ephemeral `File` objects and progress. Its TUS plugin sends directly to the hosted private `customer-artwork` bucket in 6 MiB chunks with three concurrent transfers and bounded retries. `getSession()` is used only to forward a current bearer token to Storage; server authorization uses verified JWT claims. Tokens, upload URLs, and signed preview URLs are never stored in Zustand or Postgres.

Supported extensions are PNG, JPG/JPEG, WebP, PDF, AI, and PSD with a fixed extension-to-MIME mapping. Each file is limited to 50 MiB; one draft is limited to 20 non-deleting records and 250 MiB declared. These are development safeguards, not production acceptance promises. No magic-byte inspection, malware scan, conversion, PDF rendering, PSD parsing, or artwork approval exists.

Storage success is followed by a protected completion call. The server reads the exact `storage.objects` row, verifies owner, size, and MIME, and only then marks the record uploaded. Artwork-step reconciliation recovers a lost callback, expires old attempts, and revokes readiness if a completed object disappears.

Reconciliation uses the submitted expected draft version. A stale reconciliation or acknowledgment returns `VERSION_CONFLICT` with the safe canonical snapshot and cannot adopt a newer draft version as authority. Progress revocation checks and updates that expected version in the same locked operation.

Pending uploads survive refresh as records, but the browser cannot restore file bytes. The customer must first choose the exact visible pending or failed record and then reselect its local file. The server requires that explicit recovery record ID plus matching owner, draft, route, purpose, fingerprint, normalized name, declared bytes, MIME, and last-modified value. Fingerprint metadata is only a recovery aid: two new files with identical metadata remain separate reservations, IDs, and paths.

Unexpired recovery reuses the exact reservation and path. Expired recovery first reconciles a valid completed object if one exists; otherwise it retires the old row and creates a new ID and path. A retained partial TUS resource may remain until Supabase expires it. Automatic large-file persistence across a browser restart is not promised.

Only an unexpired pending reservation or an unexpired `upload_failed` retry authorizes Storage INSERT. Expired and other failed states require explicit recovery; they cannot continue transferring to the retired path.

## Canonical TUS transport identity

The Uppy file that performs a TUS transfer is rebound to an ID containing the server-issued artwork UUID before any byte request starts. The installed `@uppy/tus` plugin fingerprints browser uploads from that Uppy file ID and the endpoint, so each reservation owns one transport identity. Draft ID and local filename, size, MIME, and last-modified metadata are not sufficient transport identity: byte-identical selections remain separate artwork IDs, paths, Uppy IDs, fingerprints, and TUS creation requests.

The original filename remains customer-facing display metadata. Explicit unexpired recovery reuses the same artwork ID and transport identity. Expired restart, missing-object restart, and replacement receive new IDs and cannot select a retained TUS URL belonging to the old reservation. Successful transfer removes its saved fingerprint entry; an abandoned provider-side partial resource can remain until provider expiry.

Byte transfers remain concurrent up to three. Canonical response application is separately coordinated with operation order, record versions, and deletion tombstones so delayed completion, refresh, or error snapshots cannot downgrade an uploaded record or resurrect a deleted row. The lock order is always durable-draft flush first, then artwork canonical application for operations that can change the draft.
