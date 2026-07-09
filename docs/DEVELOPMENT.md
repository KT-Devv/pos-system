# Development Guide

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run linter

## Project Architecture

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Overview of sales, profit, stock alerts |
| Sales | `/sales` | POS screen with cart and checkout |
| Products | `/products` | Manage product catalog |
| Inventory | `/inventory` | Track stock movements |
| Customers | `/customers` | Customer database |
| Reports | `/reports` | Analytics and reports |
| Settings | `/settings` | Shop and user settings |

### Components

All UI components are in `src/components/ui/`. They follow shadcn/ui patterns:

- `Button` - Primary action button
- `Input` - Text input field
- `Card` - Content container
- `Badge` - Status labels
- `Dialog` - Modal dialogs
- `Select` - Dropdown selection
- `Label` - Form labels
- `Switch` - Toggle switches

### State Management

Currently using local state with `useState`. For production:

1. Add React Context for global state (cart, auth)
2. Consider Zustand or Jotai for complex state
3. Use TanStack Query for server state

## Connecting to Supabase

1. Create `.env` file in `frontend/`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

2. Run the SQL schema in Supabase SQL Editor

3. Enable Email Authentication in Supabase Dashboard

## Customization

### Changing Currency

Edit `src/lib/utils.ts`:

```typescript
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS", // Change this
    minimumFractionDigits: 2,
  }).format(amount);
}
```

### Changing Theme

Edit `src/index.css` CSS variables in the `@theme` block.

### Adding New Pages

1. Create page in `src/pages/YourPage.tsx`
2. Add route in `src/App.tsx`
3. Add nav item in `src/layouts/Layout.tsx`

## Deployment

### Vercel (Recommended)

```bash
npm run build
```

Deploy the `dist/` folder to Vercel.

### Netlify

Connect your GitHub repo and set:
- Build command: `npm run build`
- Publish directory: `dist`

## Next Steps

1. Implement Supabase authentication
2. Connect pages to real database
3. Add form validation with Zod
4. Implement receipt printing
5. Add offline support with service workers
