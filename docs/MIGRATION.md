# Next.js and Tauri migration

The migration is complete and the new clients are buildable:

- `packages/next-web` is the active Next.js App Router browser workspace.
- `packages/desktop/src-tauri` is the active Tauri 2 desktop application.
- The retired Vite and Electron clients have been removed.

## Commands

```powershell
npm install
npm run dev:next
npm run build:next
npm run dev:tauri
npm run build:tauri
```

`npm run build:tauri` runs the Next.js static export, compiles the Rust
application, and produces both MSI and NSIS Windows installers. Node remains
required for the Next.js build toolchain; the shipped desktop application does
not bundle Node or Electron. Rust, Cargo, the MSVC C++ workload, and the
Windows SDK must be installed first.

## Supabase

Apply `database/schema.v2.sql` to a Supabase project and configure:

```text
packages/next-web/.env.local
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

The Next client uses `create_sale` for stock-safe checkout and
`record_stock_movement` for atomic inventory changes. Apply the schema before
using these workflows.

## Tauri offline queue

The Tauri SQL plugin creates `sqlite:pos.db` and the
`offline_operations` table. The Rust commands are:

- `queue_sale`
- `pending_operations`
- `remove_operation`

The Next/Tauri renderer invokes these commands only when running inside Tauri.
Queued sales are synchronized through Supabase when connectivity returns.

## Installer output

```text
packages/desktop/src-tauri/target/release/bundle/msi/
packages/desktop/src-tauri/target/release/bundle/nsis/
```

Generated build output is ignored and should not be committed.
