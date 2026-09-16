# Next.js and Tauri migration

The repository now contains the new client foundations:

- `packages/next-web` — static-exportable Next.js App Router client.
- `packages/desktop/src-tauri` — Tauri 2 shell with a SQLite offline operation queue.
- `packages/web` and the existing Electron client remain available during migration.

## Commands

```bash
npm run dev:next
npm run build:next
npm run dev:tauri
npm run build:tauri
```

Tauri requires the Rust toolchain and platform prerequisites. The JavaScript
dependencies and configuration are present, but `build:tauri` cannot run until
`cargo` is installed and available on `PATH`.

The Next client provides authenticated product, sales, inventory, customer,
reports, and profile workflows. Checkout calls the transactional Supabase
`create_sale` RPC; inventory calls `record_stock_movement`, which updates stock
and records the movement atomically. Desktop-only sales use
`queueDesktopSale`; queued operations are persisted in the Tauri SQLite
database and synchronized when the client is online again.

Apply `database/schema.v2.sql` to the Supabase project before using these
workflows. The existing Vite/Electron clients remain available until the
Tauri build is verified on a machine with Rust installed.
