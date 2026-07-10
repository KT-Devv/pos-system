# POS System

A modern Point of Sale (POS) system built for small businesses in Ghana.

## Packages

| Package | Description |
|---------|-------------|
| `packages/web` | Cloud web app (React + Supabase) |
| `packages/desktop` | Offline Electron desktop app (SQLite) |
| `packages/shared` | Shared UI components and types |

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Web backend**: Supabase (PostgreSQL + Auth)
- **Desktop backend**: SQLite via sql.js (Electron)
- **UI**: Radix UI + shared component library

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Supabase account (for web app)

### Installation

```bash
git clone <your-repo-url>
cd "POS System"
npm install
```

### Web app

```bash
cp .env.example packages/web/.env
# Edit packages/web/.env with your Supabase credentials
npm run dev:web
```

Run `database/schema.sql` in Supabase SQL Editor. For existing databases, also run `database/migrations/001_fixes.sql`.

### Desktop app

```bash
npm run dev:desktop
```

## Scripts

- `npm run dev:web` — Start web dev server
- `npm run dev:desktop` — Start Electron app
- `npm run build:web` — Build web for production
- `npm run build:desktop` — Build desktop for production
- `npm run build:shared` — Build shared package

## Currency

Default currency is Ghana Cedi (GHS).

## License

MIT
