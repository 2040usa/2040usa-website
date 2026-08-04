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
