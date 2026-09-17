# POS System

A point-of-sale system for small businesses in Ghana. The active rewrite uses
Next.js for the browser workspace and Tauri 2 for the Windows desktop client,
with Supabase as the shared backend and a local SQLite queue for offline sales.

## Current architecture

| Package | Purpose |
| --- | --- |
| `apps/web` | Next.js App Router client with Supabase authentication and POS workflows |
| `apps/desktop/src-tauri` | Tauri 2 desktop shell, Rust commands, and SQLite offline queue |
| `packages/shared` | Shared domain types, validation, calculations, and UI components |

## System structure

```text
pos-system/
├── apps/
│   ├── web/                         # Next.js browser application
│   │   ├── src/app/                # Routes and feature workspace
│   │   ├── src/lib/                # Supabase and Tauri bridges
│   │   ├── .env.example            # Browser environment template
│   │   └── next.config.ts
│   └── desktop/                    # Tauri workspace package
│       ├── src-tauri/              # Rust native shell and SQLite queue
│       │   ├── src/                # Commands and native entry points
│       │   ├── icons/              # Installer icon assets
│       │   ├── Cargo.toml
│       │   └── tauri.conf.json
│       └── package.json             # Tauri development/build commands
├── packages/
│   └── shared/                     # Shared domain contracts and UI primitives
├── database/
│   └── schema.v2.sql               # Supabase tables, RLS, and RPCs
├── docs/                           # Development, migration, and accessibility docs
├── package.json                    # Workspace scripts
└── package-lock.json
```

`apps/web` is the only user-facing JavaScript application. `apps/desktop`
packages the same exported web application inside Tauri; it does not contain a
second renderer. `packages/shared` is dependency-free domain code shared by
the web build and native integrations.

The Next.js client currently includes authenticated product management, sales
checkout, customers, inventory movements, reports, and profile settings.
Checkout uses the atomic `create_sale` Supabase function. Inventory uses
`record_stock_movement`, which updates stock and records the movement in one
transaction. Tauri queues offline sales locally and synchronizes them when the
desktop client is online.

## Requirements

For the web client:

- Node.js 18 or newer
- npm 10 or newer
- A Supabase project

For Tauri development and Windows packaging:

- Rust toolchain with Cargo
- Visual Studio Build Tools 2022
- Desktop development with C++
- MSVC v143 build tools
- Windows 10/11 SDK
- WebView2 runtime

## Setup

Clone the repository and install workspace dependencies:

```powershell
git clone https://github.com/KT-Devv/pos-system.git
cd pos-system
npm install
```

Create the Next.js environment file:

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
```

Set these values in `apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Supabase setup

1. Create or open a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**.
3. Run `database/schema.v2.sql` against the project.
4. Enable Email authentication under **Authentication > Providers**.
5. Create the first user through Supabase Authentication.
6. The database trigger creates the corresponding admin profile.

The schema creates the POS tables, row-level security policies, the
transactional `create_sale` function, and the atomic `record_stock_movement`
function. Do not run the obsolete `database/migrations/001_fixes.sql` against
the new schema.

## Development commands

Run these commands from the repository root:

```powershell
# Next.js browser client
npm run dev:web
npm run build:web

# Tauri desktop client
npm run dev:tauri
npm run build:tauri

# Shared package type check/build
npm run build:shared
```

`npm run dev:tauri` starts the Next.js development server through the Tauri
configuration. `npm run build:tauri` performs the Next.js static export,
compiles Rust, and creates the Windows installers.

## Windows installer output

After a successful Tauri build:

```text
apps/desktop/src-tauri/target/release/bundle/msi/
apps/desktop/src-tauri/target/release/bundle/nsis/
```

The generated artifacts are:

- `POS System_1.0.0_x64_en-US.msi`
- `POS System_1.0.0_x64-setup.exe`

Build output under `target/`, `out/`, `dist/`, and `.next/` is ignored by Git.

## Offline behavior

The Tauri client stores pending sale operations in `sqlite:pos.db`. When the
client is online, queued operations are sent through the Supabase
`create_sale` function and removed only after successful synchronization.
Stock validation remains server-side, so rejected or conflicting sales are
reported instead of being silently discarded.

## Currency and payments

The default currency is Ghanaian cedi (GHS). Supported payment methods are
cash, mobile money, and card.

## License

MIT
