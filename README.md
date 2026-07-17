# POS System

A modern Point of Sale (POS) system built for small businesses in Ghana.

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **UI Components**: Radix UI + shadcn/ui patterns

## Features

### MVP (v1)
- Dashboard with sales overview
- Product management (CRUD)
- POS screen with cart functionality
- Multiple payment methods (Cash, MoMo, Card)
- Inventory management with stock tracking
- Customer database with loyalty points
- Reports and analytics
- Receipt generation

### Coming in v2
- Barcode scanning
- QR code payments
- SMS/WhatsApp receipts
- Expense tracking
- Supplier management
- Offline mode

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (free tier works)

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd pos-system/frontend
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```
Edit `.env` with your Supabase credentials.

4. Start development server
```bash
npm run dev
```

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema from `database/schema.sql`
3. Enable Email Auth in Authentication settings
4. Copy your project URL and anon key to `.env`

## Project Structure

```
frontend/
├── src/
│   ├── components/ui/    # Reusable UI components
│   ├── layouts/          # App layout with sidebar
│   ├── pages/            # Page components
│   ├── lib/              # Utilities and Supabase client
│   ├── types/            # TypeScript type definitions
│   └── hooks/            # Custom React hooks
├── database/             # SQL schemas
└── docs/                 # Documentation
```

## Currency

This system uses Ghana Cedi (GHS) as the default currency.

## License

MIT
