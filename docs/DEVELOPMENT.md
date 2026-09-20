# Development Guide

## Quick start

Install dependencies from the repository root:

```powershell
npm install
Copy-Item apps/web/.env.example apps/web/.env.local
```

Set the Supabase URL and anon key in `apps/web/.env.local`, then run:

```powershell
npm run dev:web
```

The Next.js workspace is available at `http://localhost:3000`.

## Active commands

```powershell
npm run dev:web
npm run build:web
npm run dev:tauri
npm run build:tauri
npm run build:shared
```

The Tauri development command starts the Next.js dev server through
`src-tauri/tauri.conf.json`. The production command exports Next.js, compiles
Rust, and creates MSI and NSIS installers.

## Architecture

The active clients are:

- `apps/web` — browser UI and Supabase workflows.
- `apps/desktop/src-tauri` — Tauri shell, Rust commands, and SQLite offline queue.
- `packages/shared` — shared types, validation, calculations, and UI components.

The old Vite browser client and Electron desktop client were removed after the
Tauri migration. Node is retained as the Next.js development/build toolchain;
it is not bundled into the Tauri application.

## Supabase

1. Run `database/schema.v2.sql` in the Supabase SQL Editor (existing single-shop
   projects run migrations 002 to 004 instead; see the README).
2. Enable Email authentication.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
   `apps/web/.env.local`.
4. Run the app, create an account, and complete the first-login shop setup.

The schema is multi-tenant: every business table carries a `shop_id` and is
protected by row-level security. See [MULTI_TENANCY.md](MULTI_TENANCY.md) before
adding tables or queries. It provides `create_sale` for transactional checkout and
`record_stock_movement` for atomic inventory changes.

## Tests

```powershell
npm test --workspace=packages/shared
```

The shared suite covers pricing, reports, shop validation, roles and money
formatting. Database rules (tenant isolation, roles, invitations) have their own
suite, which runs against an in-memory Postgres:

```powershell
npm run test:db
```

## Accessibility

Use the Next.js app as the active accessibility target. Run a production build
before deployment:

```powershell
npm run build:web
```

## Build outputs

Tauri installers are written to:

```text
apps/desktop/src-tauri/target/release/bundle/msi/
apps/desktop/src-tauri/target/release/bundle/nsis/
```
