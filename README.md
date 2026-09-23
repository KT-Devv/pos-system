# KT POS System

A multi-shop point-of-sale system for retail businesses. Each business signs up,
sets up its own shop on first login (name, country, currency and preferences),
and invites its staff. The browser workspace uses Next.js, the Windows desktop
client uses Tauri 2, and both share one Supabase backend with strict per-shop
data isolation and a local SQLite queue for offline sales.

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
│   ├── schema.v2.sql               # Multi-tenant Supabase tables, RLS, and RPCs
│   └── migrations/                 # Upgrade scripts for existing databases
├── docs/                           # Development, migration, and accessibility docs
├── package.json                    # Workspace scripts
└── package-lock.json
```

`apps/web` is the only user-facing JavaScript application. `apps/desktop`
packages the same exported web application inside Tauri; it does not contain a
second renderer. `packages/shared` is dependency-free domain code shared by
the web build and native integrations.

The Next.js client currently includes first-login shop setup, team management,
product management, sales checkout, customers, inventory movements, reports,
and shop and profile settings.
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
5. Under **Authentication > URL Configuration**, set the Site URL and add
   `/login` and `/reset-password` on your app's address to the redirect list.
6. For real customers, configure your own SMTP provider under **Authentication >
   Emails**; the built-in sender allows only a few emails per hour.

There is nothing else to seed. Anyone can sign up in the app; on first login they
create their shop or accept an invitation to one (see
[docs/MULTI_TENANCY.md](docs/MULTI_TENANCY.md)).

The schema creates the tables, row-level security policies, the shop and team
functions, the transactional `create_sale` function, and the atomic
`record_stock_movement` function. Do not run the obsolete
`database/migrations/001_fixes.sql`.

### Upgrading an existing single-shop database

Projects created before shops existed must run, in order,
`database/migrations/002_role_based_access.sql`,
`003_rpc_security_and_roles.sql` and `004_multi_tenant_shops.sql` in the SQL
editor. Migration 004 moves all existing data into one shop called "My Shop"
(currency GHS, the old default), makes the first admin its owner, and runs in a
single transaction, so a failure changes nothing. Afterwards, rename the shop and
check its currency in **Settings > Shop**. If the currency is wrong, fix it with
`update public.shops set currency = 'USD';` in the SQL editor.

### Adding pack sizes to a database that already has shops

Databases that already run the shop version (004, and 005 for the table grants)
must also run `database/migrations/006_product_units.sql` once in the SQL editor
**before** the new app is deployed: the sales, products and reports screens read
the new pack size columns. It changes nothing about existing products, prices,
stock or sales. Fresh installs get it from `schema.v2.sql`.

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

- `KT POS System_1.0.0_x64_en-US.msi`
- `KT POS System_1.0.0_x64-setup.exe`

Build output under `target/`, `out/`, `dist/`, and `.next/` is ignored by Git.

## Offline behavior

The Tauri client stores pending sale operations in `sqlite:pos.db`. When the
client is online, queued operations are sent through the Supabase
`create_sale` function and removed only after successful synchronization.
Stock validation remains server-side, so rejected or conflicting sales are
reported instead of being silently discarded. Each queued sale records the shop
it belongs to and is only ever synchronized to that shop, so two accounts sharing
one computer cannot mix their sales.

## Shops, currency and payments

Every shop chooses its own country and currency when it is created; amounts
are formatted in that currency everywhere. The currency is locked once the shop
records its first sale. Supported payment methods are cash, mobile money and
card. Shops also set their own low-stock warning level and loyalty rules.

## Pack sizes

A product is priced per single item, and its stock is counted in single items.
It can also be sold in **pack sizes**: a pack, box, strip or bag that holds a fixed
number of those items at its own price ("Pack of 12" for 40.00, "Box of 48" for
150.00). Add them under **Pack sizes** in the product form.

- On the Sales screen each pack size is a button on the product's tile. A pack
  is its own line in the cart, priced at the pack price, and selling one takes the
  whole pack out of stock. Packs and singles of one product share the same stock,
  so the tile always shows what is really left.
- Stock stays a single number in single items. Products and Inventory also show it
  as packs plus singles ("2 × Box of 48 + 1 × Pack of 12 + 2 singles"), and
  Inventory can receive or recount stock in packs.
- A pack size can have its own barcode; scanning it adds that pack.
- Receipts name the pack on the line ("Milk 1L (Pack of 6)"), reports count single
  items sold, and a pack sale queued offline in the desktop app keeps its pack size.

## Receipts, barcodes and labels

After each sale a receipt opens with the shop's name, address and phone, the
items, totals, payment and change. **Print receipt** uses the system print
dialog (the browser's on the web, the WebView's in the desktop app), laid out
for 80 mm paper, so it works with any installed printer including thermal
receipt printers. Past sales can be reprinted from **Recent sales**; a reprint
does not show cash received or change because the database does not store them.
A sale rung up offline prints with an "offline sale" notice, and its receipt
number changes once it syncs because the server assigns the final one.

Products can be found by code three ways: a USB scanner (it types the code
and presses Enter in the search box), the **Scan** button (the device camera,
loaded only when opened), or typing the code. The camera reads retail barcodes
and QR codes. A QR code may hold the plain code, a GS1 link, or a product link
that ends in the code; the shop's code is found inside it. A 12-digit UPC-A, its
13-digit EAN-13 form and the 14-digit GTIN count as the same code. The camera
asks for autofocus, offers tap-to-focus, zoom, a light and a camera switch where
the device supports them, and remembers which camera you chose. On the Products
screen admins can scan or generate a code for an item that has none (in-store
EAN-13 codes starting with 2) and print labels as a Code 128 barcode or a QR
code in 40 x 25, 50 x 30 or 60 x 40 mm.

## License

MIT
