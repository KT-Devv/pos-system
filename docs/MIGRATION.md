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

The Next client currently provides the route shell and authentication boundary.
Feature adapters should call the shared domain validation and the Supabase
`create_sale` RPC. Desktop-only sales can use `queueDesktopSale`; queued
operations are persisted in the Tauri SQLite database for later synchronization.
