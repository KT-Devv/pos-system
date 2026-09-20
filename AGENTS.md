# KT POS System — Development Instructions

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

Apply `database/schema.v2.sql` to Supabase before using the application. It is
multi-tenant: users create or join a shop on first login, and every business
table is scoped by `shop_id` (see `docs/MULTI_TENANCY.md`). Databases created
before shops existed run migrations 002, 003 and 004 in order; 003 is required
for cashiers to complete sales and 004 converts existing data into one shop.
Checkout uses the shop-scoped `create_sale(p_shop_id, ...)`; inventory uses
`record_stock_movement`. The Tauri
client stores pending sales in `sqlite:pos.db` and synchronizes them through
Supabase when connectivity returns.

## Change guidance

- Preserve the no-animation UI requirement. `globals.css` disables animation and
  transitions globally; do not add `animate-*`/`transition-*` utilities.
- Design tokens (light and dark) live in `apps/web/src/app/globals.css`. Style with
  token classes (`bg-card`, `text-muted-foreground`, `bg-success-soft`) rather than raw
  hex so both themes stay correct. Shared primitives are in `packages/shared`; screens
  are in `apps/web/src/features`, and the app shell is `apps/web/src/components`.
- Fonts are self-hosted (`@fontsource-variable/figtree`) so the offline desktop app never
  needs a CDN. Do not add remote fonts, scripts, or images.
- Chart colors come from the validated `--chart-*` tokens; assign them by entity (for
  example payment method), never by rank.
- Keep business validation in `packages/shared` or the Supabase RPCs.
- Keep web and desktop behavior aligned; desktop should only add native/offline
  capabilities.
- Never hardcode a currency, symbol or store-specific value. Read the shop's
  settings through `useWorkspace()` (`shop.currency`, `shop.low_stock_threshold`,
  `shop.loyalty_*`) and format money with `formatCurrency`.
- Every new business table needs a `shop_id`, shop-scoped foreign keys, RLS
  policies built on `is_shop_member` / `is_shop_admin`, and a query that sets
  `shop_id` on insert.
- Do not commit `.next`, `out`, `dist`, `target`, or installer output.
