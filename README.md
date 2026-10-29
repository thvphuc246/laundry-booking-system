# Laundry booking

Book the laundry room for your rental apartment. 1-hour slots, 07–22, max 2 h/day and 6 h/week per apartment
(Helsinki calendar day, Mon–Sun week), up to 14 days ahead. Slots starting within 2 h ignore the limits.

Residents sign in with Google, request an apartment, and an admin (`ADMIN_EMAILS`) approves them. One approved resident per apartment.

Stack: Bun · React + Vite · Hono · Drizzle + MySQL (TiDB in prod) · Vercel.

## Local

Requires Bun and Docker.

```sh
cp .env.example .env
docker compose up -d --wait
bun install
bun run db:push
bun run db:seed
bun dev
bun test
```

## Test environment

Mock data and load tests run only against localhost or a database whose name contains `test`; the scripts refuse anything else.

```sh
bun run db:mock              # wipe, then one busy building: 60 approved, 10 pending, 6 weeks of bookings
bun run db:wipe              # delete all bookings and every user not in ADMIN_EMAILS
bun run test:as approved     # switch the first ADMIN_EMAILS user (sign in once first) to a status
bun run test:as approved A1  # take over A1 and see its bookings as yours
bun run load                 # reseed, run the booking races, then 3 bursts of every mocked resident
```

`load` signs session cookies with `SESSION_SECRET`, so it must match the server's, and it reads `DATABASE_URL` to reseed and verify, so it must be the server's database. It targets `LOAD_URL` (default `http://localhost:3000`, the API from `bun dev`) and exits non-zero when a race check fails or any response is a 5xx.

### Staging

1. Create a separate free TiDB Serverless cluster with a database named `laundry_test`.
2. On Vercel, assign a fixed domain (e.g. `laundry-staging.vercel.app`) to the `master` branch, and set the Preview env vars: the staging `DATABASE_URL`, a new `SESSION_SECRET`, `ADMIN_EMAILS` and the existing `GOOGLE_ID` / `GOOGLE_SECRET`.
3. In Google Cloud Console → Credentials → the OAuth client, add `https://<staging-domain>/api/auth/google` to Authorized redirect URIs. If the OAuth consent screen is in Testing, add your email under Test users.
4. Put the same values in an untracked `.env.staging`, plus `LOAD_URL=https://<staging-domain>` and, if Deployment Protection is on, `VERCEL_AUTOMATION_BYPASS_SECRET` from Project Settings → Deployment Protection → Protection Bypass for Automation.
5. `bun --env-file=.env.staging run db:push`, `db:seed`, then `db:mock` or `load`. Watch Vercel Logs / Observability and the TiDB console's slow queries and Request Units while it runs.
