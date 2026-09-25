# Laundry booking

Book the laundry room for your rental apartment. 1-hour slots, 07–22, max 2 h/day and 6 h/week per apartment
(Helsinki calendar day, Mon–Sun week), up to 14 days ahead.

Residents sign in with Google, request an apartment, and an admin (`ADMIN_EMAILS`) approves them. One approved resident per apartment.

Stack: Bun · React + Vite · Hono · Drizzle + MySQL (TiDB in prod) · Vercel.

## Local

Requires Bun and Docker.

```sh
cp .env.example .env
docker compose up -d
bun install
bun run db:push
bun run db:seed
bun dev
bun test
```
