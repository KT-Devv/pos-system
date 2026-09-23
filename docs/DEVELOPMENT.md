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

## Printing

Receipts and labels print through `PrintArea` (`apps/web/src/components/print-area.tsx`).
It renders the paper as a direct child of `<body>`, and the `.print-root` rules in
`globals.css` hide everything else while printing, so never print by calling
`window.print()` on a screen that has no print area. Keep the paper black on white
and size it in millimetres. Receipt data comes from `buildReceipt` and barcode
encoding from `code128Bars`, both in `packages/shared` with tests. To check the print
layout without a printer, emulate print media (in the browser's dev tools, or over the
debugging protocol with `Emulation.setEmulatedMedia`) and look at the result.

Two rules learned from testing in the desktop window:

- Label paper sizes are named `@page` rules in `globals.css` (`label-small`, `label-standard`,
  `label-large`), chosen with `<PrintArea page="label-standard">`. Never write an inline
  `<style>` for print: the desktop app's content-security policy blocks it and the page size
  is silently ignored (labels came out on a full Letter page).
- Printing hides every `<header>`, `<nav>` and `<aside>` to drop the app's own chrome. The
  `.print-root` rules restore them inside the paper, but prefer plain `<div>`s there: a receipt
  header once printed without the shop's name because of this.

Testing the desktop window: build it with `tauri build --debug --no-bundle` (use a different
`identifier` in a `--config` override so the test does not touch a real offline database),
then start the exe with the environment variable `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` set to
`--remote-debugging-port=9222 --use-fake-device-for-media-stream --use-fake-ui-for-media-stream
--use-file-for-fake-video-capture=<video.y4m>`. That gives a debugging endpoint to drive the
real window, and a fake camera that plays a picture of a code.

Camera scanning uses `html5-qrcode`, imported on demand and bundled (no CDN), so it
also works in the offline desktop app. It needs a secure context (https or the
desktop app) and a camera the user has allowed; the scanner dialog always offers
manual entry as a fallback.

html5-qrcode's own QR decoder fails on roughly 3 to 9 percent of perfectly valid codes
(measured by decoding several hundred clean codes; jsQR reads all of them), and on
browsers without a native barcode reader (desktop, iPhone, the Windows app) that decoder
is the one that runs. So QR codes are also searched by jsQR, in a Web Worker
(`features/qr-worker.ts`) because a search of a busy picture can take half a second and
would freeze the page on the main thread. The worker is skipped where the browser
reports a native QR reader. Retail barcodes still go through html5-qrcode alone. The
scan area is the whole picture (no scan box), so a QR code held close is never cut off.
Both decoders feed one handler that ignores a code that has stayed in view.

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
