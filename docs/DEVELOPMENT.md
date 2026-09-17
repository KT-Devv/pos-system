# Development Guide

## Quick start

Install dependencies from the repository root:

```powershell
npm install
Copy-Item packages/next-web/.env.example packages/next-web/.env.local
```

Set the Supabase URL and anon key in `packages/next-web/.env.local`, then run:

```powershell
npm run dev:next
```

The Next.js workspace is available at `http://localhost:3000`.

## Active commands

```powershell
npm run dev:next
npm run build:next
npm run dev:tauri
npm run build:tauri
npm run build:shared
```

The Tauri development command starts the Next.js dev server through
`src-tauri/tauri.conf.json`. The production command exports Next.js, compiles
Rust, and creates MSI and NSIS installers.

## Architecture

The active clients are:

- `packages/next-web` — browser UI and Supabase workflows.
- `packages/desktop/src-tauri` — Tauri shell, Rust commands, and SQLite offline queue.
- `packages/shared` — shared types, validation, calculations, and UI components.

The old Vite browser client and Electron desktop client were removed after the
Tauri migration. Node is retained as the Next.js development/build toolchain;
it is not bundled into the Tauri application.

## Supabase

1. Run `database/schema.v2.sql` in the Supabase SQL Editor.
2. Enable Email authentication.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
   `packages/next-web/.env.local`.

The schema provides `create_sale` for transactional checkout and
`record_stock_movement` for atomic inventory changes.

## Accessibility

Use the Next.js app as the active accessibility target. Run a production build
before deployment:

```powershell
npm run build:next
```

## Build outputs

Tauri installers are written to:

```text
packages/desktop/src-tauri/target/release/bundle/msi/
packages/desktop/src-tauri/target/release/bundle/nsis/
```
