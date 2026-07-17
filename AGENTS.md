# POS System — Project Context

## Architecture

- **Monorepo** with npm workspaces: `packages/web`, `packages/desktop`, `packages/shared`
- `@pos/shared` — shared types, components (Radix UI + Tailwind), utils, consumed via Vite alias
- **Web**: React + Vite 8.x + Supabase (PostgreSQL) + Tailwind CSS v4
- **Desktop**: React + Electron (electron-vite, Vite 5.4.21) + sql.js (SQLite) + Tailwind CSS v4

## Dev Commands

```bash
# Web
cd packages/web && npm run dev        # Vite dev server
cd packages/web && npm run build      # tsc -b && vite build

# Desktop
cd packages/desktop && npx electron-vite dev -c electron-vite.config.ts
cd packages/desktop && npx electron-vite build -c electron-vite.config.ts

# TypeScript checks
cd packages/desktop && npx tsc --noEmit
cd packages/web && npx tsc -b --noEmit
```

## Desktop Architecture

- `electron/main.ts` — Electron main entry (window: 1400x900, sandbox:true)
- `electron/preload.ts` — contextBridge exposing `window.electronAPI` (38 IPC channels)
- `electron/ipc/*.ts` — IPC handlers (auth, products, sales, categories, customers, inventory, settings, reports, dashboard, users)
- `electron/db/` — sql.js SQLite database + schema
- `electron/lib/` — session management, PIN hashing, DB helpers
- `electron/services/` — receipt printing (thermal USB + PDF)
- `src/` — React renderer (HashRouter, not BrowserRouter)
- `src/lib/ipc.ts` — ElectronAPI proxy (`api.*` calls → IPC invoke)
- `src/shared-classes.ts` — Tailwind CSS class manifest for shared components (CRITICAL, see below)

## Critical: Tailwind CSS v4 + electron-vite Scanning Fix

**Problem**: `@tailwindcss/vite@4.3.2` with electron-vite (Vite 5.x) only scans `packages/desktop/src/`. Shared components at `../shared/src/` are NOT scanned despite Vite alias resolution. This caused all Radix UI dialogs/modals to be invisible (missing `position:fixed`, `z-index:50`, `bg-black/80`, animation classes).

**Solution**: `src/shared-classes.ts` — a file containing all shared component class names as string literals. The Tailwind scanner finds these within desktop's own `src/` directory. File has `// @ts-nocheck` to suppress unused variable errors.

**Result**: CSS went from 31KB → 46KB, matching web exactly. ALL dialog/modal/dropdown classes now present.

**If adding new shared components**: Extract their Tailwind classes and add them to `shared-classes.ts`.

## IPC Channel Reference (Desktop)

| Channel | Purpose |
|---------|---------|
| `auth:login` | PIN login → returns `{user, sessionToken}` |
| `auth:logout` | Clears session |
| `auth:me` | Current user from token |
| `products:list` | List products (optional search) |
| `products:get` | Get product by ID |
| `products:getByBarcode` | Lookup by barcode OR ID |
| `products:create` | Create product (admin) |
| `products:update` | Update product (admin) |
| `products:delete` | Delete product (admin) |
| `products:stats` | Product counts |
| `categories:list/create/delete` | Category CRUD |
| `sales:list/create/getWithItems` | Sales operations |
| `sales:todayStats` | Today's sales summary |
| `inventory:stockHistory/create` | Stock entries |
| `inventory:suppliers/list/create/delete` | Supplier CRUD |
| `dashboard:summary` | Dashboard stats |
| `customers:list/create/update/delete` | Customer CRUD |
| `settings:get/set/bulkSet` | Key-value settings |
| `settings:isSetupComplete` | Setup wizard check |
| `settings:getSetupSummary` | Setup summary |
| `users:list/create/update/delete` | User management (admin) |

## Barcode Features (Both Web + Desktop)

### Products Page
- **Add/Edit dialogs**: "Scan Barcode" button opens QRScanner (camera or manual entry)
- After scan, shows barcode with icon + Remove button
- Barcode passed to `addProduct()` / `updateProduct()` hooks
- Product cards display barcode (mono font) + Print Label button (barcode icon)

### Sales Page
- **Barcode text input**: For USB HID scanners (keyboard emulation). Enter key triggers lookup.
- **"Scan" button**: Opens QRScanner dialog with camera/manual modes
- **"Lookup" button**: Manual barcode search
- Camera scan result → `api.products.getByBarcode()` (desktop) / Supabase `barcode.eq` or `id.eq` (web)
- F2 hotkey focuses barcode input (desktop only)

### Components
- `QRScanner.tsx` — Camera (html5-qrcode library, dynamic import) + manual entry dialog
- `BarcodeLabel.tsx` — QR code generation (qrcode library) + 60×40mm print label dialog

### Dependencies
- `html5-qrcode` — camera barcode/QR scanning
- `qrcode` + `@types/qrcode` — QR code image generation

## Desktop vs Web Differences

| Feature | Desktop | Web |
|---------|---------|-----|
| Database | SQLite (sql.js) via IPC | Supabase (PostgreSQL) |
| Auth | PIN-based login | Email/password (Supabase Auth) |
| Router | HashRouter | BrowserRouter |
| Barcode lookup | IPC `products:getByBarcode` | Supabase query `.or(barcode.eq, id.eq)` |
| Thermal printer | `node-thermal-printer` via IPC | Not available |
| Setup wizard | First-run setup via `SetupGate` | Not needed |
| Shared CSS fix | `shared-classes.ts` manifest | Not needed (Vite 8.x resolves aliases) |

## Shared Types

```typescript
interface Product {
  id: string; name: string; category_id: string | null;
  cost_price: number; selling_price: number; stock: number;
  barcode: string | null; image: string | null;
  qr_code?: string | null; category_name?: string | null;
  created_at: string;
}

interface CartItem { product: Product; quantity: number; }

interface StockHistory {
  id: string; product_id: string; type: string;
  quantity: number; supplier_id: string | null;
  notes: string | null; created_at: string;
}

interface StockHistoryRow extends StockHistory {
  product_name?: string; supplier_name?: string;
}
```

## Known Gotchas

- `noUnusedLocals: true` and `noUnusedParameters: true` in both tsconfigs
- Desktop auth: `api.auth.login(pin)` returns `{id, name, role}` — preload stores token
- Desktop settings stored in SQLite `settings` table as `key→value` strings
- `electron-vite@2.3.0` bundles `vite@5.4.21` internally
- Radix Dialog uses `DialogPortal` to render into `document.body`
- `tw-animate-css@1.0.x` installed (Tailwind v4 compatible); uses `@import "tw-animate-css"` (NOT `@plugin`)
- `@source` directive in CSS does NOT work with electron-vite — use `shared-classes.ts` instead
- `Barcode` and `ScanBarcode` icons exist in `lucide-react`
- Web `useProducts` hook already supported `barcode` in add/update before our changes
