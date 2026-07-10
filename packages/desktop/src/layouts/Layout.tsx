import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  BarChart3,
  Settings,
  Users,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '@pos/shared/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/sales', icon: ShoppingCart, label: 'Sales' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/inventory', icon: Warehouse, label: 'Inventory' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar - Glassmorphic design */}
      <aside className="w-64 glass-panel flex flex-col z-20 border-r border-white/5 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent opacity-50 pointer-events-none"></div>
        
        <div className="p-6 border-b border-white/5 relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center border border-primary/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <span className="font-bold text-lg leading-none">P</span>
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              POS System
            </h1>
          </div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Workspace
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 relative z-10 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 relative group overflow-hidden',
                  isActive
                    ? 'text-white bg-primary/20 border border-primary/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]'
                    : 'text-muted-foreground hover:text-white hover:bg-white/5'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 w-1 h-1/2 bg-primary rounded-r-full top-1/4"></div>
                  )}
                  <item.icon className={cn("h-4 w-4 shrink-0 transition-transform duration-300", isActive ? "text-primary scale-110" : "group-hover:scale-110")} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 relative z-10 bg-black/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center border border-white/10 shadow-lg">
              <span className="font-bold text-white shadow-sm">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-primary/80 capitalize font-medium">{user?.role || 'Staff'}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-colors border border-transparent hover:border-white/10"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative bg-background animate-in fade-in duration-500">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-50 pointer-events-none"></div>
        <div className="relative z-10 h-full p-2 md:p-6">
          <div className="glass-panel min-h-full rounded-2xl border-white/10 shadow-2xl relative">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"></div>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
