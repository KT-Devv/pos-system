# POS System — Development Instructions

## Repository structure

- `apps/web` — Next.js App Router client and Supabase workflows.
- `apps/desktop` — Tauri package; `apps/desktop/src-tauri` contains Rust
  commands, SQLite offline queue, and installer configuration.
- `packages/shared` — shared domain types, validation, calculations, and UI
  primitives.
- `database/schema.v2.sql` — active Supabase schema, RLS policies, and RPCs.
- `docs` — development, migration, and accessibility documentation.

The desktop application packages the static export from `apps/web`; it does not
have a separate renderer. Node.js is required for Next.js development/builds,
but is not bundled into the desktop application.

## Commands

Run from the repository root:

```powershell
npm install
npm run dev:web
npm run build:web
npm run dev:tauri
npm run build:tauri
npm run build:shared
```

Tauri requires Rust/Cargo, Visual Studio Build Tools with the MSVC C++ workload,
the Windows SDK, and WebView2.

## Database and runtime behavior

Apply `database/schema.v2.sql` to Supabase before using the application.
Checkout uses `create_sale`; inventory uses `record_stock_movement`. The Tauri
client stores pending sales in `sqlite:pos.db` and synchronizes them through
Supabase when connectivity returns.

## Change guidance

- Preserve the no-animation UI requirement.
- Keep business validation in `packages/shared` or the Supabase RPCs.
- Keep web and desktop behavior aligned; desktop should only add native/offline
  capabilities.
- Do not commit `.next`, `out`, `dist`, `target`, or installer output.
