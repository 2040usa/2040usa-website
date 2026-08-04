# Backend development

## Dedicated environment

Increment 2A uses only hosted project `bcalocreiqbyufnakrnq`. Docker and local Supabase are absent. Copy `.env.example` to ignored `.env.local` and provide the dedicated URL, publishable key, direct port-5432 database URL, expected reference, Turnstile development site key, private CLI credentials, and matching server/public deployment modes.

Missing, unknown, or contradictory modes fail startup. `VERCEL_ENV=production` forces production validation even if another variable says development. Never reuse another project's variables. Remote scripts verify every project identifier before acting.

## Commands

```bash
npm install
npm run supabase:version
npm run supabase:identity
npm run db:migration:history
npm run db:migration:dry-run
npm run db:migration:push
npm run prisma:validate
npm run prisma:generate
npm run test:hosted
```

There is no remote reset script. The hosted command creates exactly two tagged anonymous sessions, retains those exact IDs in memory, exercises RLS/repository/constraints only with them, and cleans only their public draft rows. It reports anonymous-user counts before and after. Auth records remain because no admin deletion key is authorized.

`prebuild` generates the ignored Prisma client. A clean build therefore succeeds after deleting `generated/prisma`; generated output is never committed. Supabase seeding is disabled until an intentional seed exists.

## Current limitation

The repository cannot prove empty-database replay without Docker, a disposable second project, or a Supabase branch. Stored migrations and hosted history match, but that is not clean-replay evidence.

## Hosted artwork workflow

The dedicated project remains `bcalocreiqbyufnakrnq`; Docker and local Supabase are not used. Verify the target and migration history before dry run or push. `npm run test:hosted` creates exactly two identified anonymous users shared across draft, artwork-table, Storage-RLS, and repository checks. Public rows and objects are cleaned through product-safe mechanisms; Auth rows remain because no admin credential is authorized.

The bucket is migration-managed. Never change it in Dashboard, run a remote reset, or delete Storage objects through SQL.

Applied migration sources are byte-immutable. Increment 2B authority and recovery corrections live only in `20260804000200_harden_artwork_authority_and_recovery.sql`. The artwork repository uses the per-draft advisory lock for reservation and cleanup preparation; browser Data API clients cannot mutate canonical artwork rows.

`20260804000300_harden_artwork_upload_attempt_policy.sql` restricts Storage INSERT to unexpired pending attempts and unexpired `upload_failed` retries. Cleanup finalization reacquires the draft advisory lock and requires an empty artwork-row set; reconciliation never substitutes the latest draft version for a stale submitted version.
