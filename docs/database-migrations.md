# Database migrations

Supabase SQL migrations are the sole database migration authority. Never create `prisma/migrations/` or run Prisma Migrate or `prisma db push`. Dashboard schema editing is prohibited.

`20260803000100_create_order_drafts.sql` creates the table, lifecycle constraints, timestamp trigger, grants, forced RLS, and owner policies. Applied migration files are byte-immutable: corrections must be expressed in a later migration, never by editing an already-applied source file. Its restored Git object hash is `90b154909c13955ff3bc99ba6018b76bfb872235`.

`20260803000200_harden_order_draft_configuration_routes.sql` drops and recreates the two existing JSON route constraints. Present JSON must contain a `route` key whose JSON type is string and whose text equals `selected_route`; missing keys, JSON null, numbers, and mismatches are rejected.

Both migrations were applied only to `bcalocreiqbyufnakrnq`. No remote reset occurred. Empty-database replay remains unproven because Docker, a disposable project, and a Supabase branch are unavailable.
