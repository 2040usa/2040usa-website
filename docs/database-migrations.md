# Database migrations

Supabase SQL migrations are the sole database migration authority. Never create `prisma/migrations/` or run Prisma Migrate or `prisma db push`. Dashboard schema editing is prohibited.

`20260803000100_create_order_drafts.sql` creates the table, lifecycle constraints, timestamp trigger, grants, forced RLS, and owner policies. Applied migration files are byte-immutable: corrections must be expressed in a later migration, never by editing an already-applied source file. Its restored Git object hash is `90b154909c13955ff3bc99ba6018b76bfb872235`.

`20260803000200_harden_order_draft_configuration_routes.sql` drops and recreates the two existing JSON route constraints. Present JSON must contain a `route` key whose JSON type is string and whose text equals `selected_route`; missing keys, JSON null, numbers, and mismatches are rejected.

Both Increment 2A migrations were applied only to `bcalocreiqbyufnakrnq`. `20260804000100_create_private_artwork_uploads.sql` adds the private bucket, `artwork_files`, lifecycle/ownership constraints, table RLS, and reservation-bound Storage policies. Applied migration files are byte-immutable. Prisma maps the schema but never migrates it.

`20260804000200_harden_artwork_authority_and_recovery.sql` is the additive Increment 2B correction. It makes authenticated Data API access to `artwork_files` read-only, replaces fingerprint uniqueness with a non-unique recovery lookup index, enforces the exact canonical Storage path, records expired-recovery lineage, and hardens immutable reservation/replacement identity. The three earlier migrations remain byte-identical.

`20260804000300_harden_artwork_upload_attempt_policy.sql` recreates only the private bucket INSERT policy. It authorizes exact-path transfers solely for unexpired pending reservations and unexpired `upload_failed` retries; every expired or non-retryable lifecycle state requires explicit recovery.

No remote reset occurred. Empty-database replay remains unproven because Docker, a disposable project, and a Supabase branch are unavailable.
