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
  Store,
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
      <aside className="w-72 bg-primary text-primary-foreground flex flex-col z-20 relative shadow-2xl shadow-primary/10">
        
        <div className="p-6 border-b border-primary-foreground/10 relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-lg shadow-accent/20">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">MomoMart</h1>
              <p className="text-xs text-primary-foreground/55">Retail workspace</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Workspace
          </p>
        </div>

        <nav className="flex-1 p-5 space-y-2 relative z-10 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-300 relative group overflow-hidden',
                  isActive
                    ? 'text-accent-foreground bg-accent shadow-lg shadow-accent/10'
                    : 'text-primary-foreground/65 hover:text-primary-foreground hover:bg-primary-foreground/10'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 w-1 h-1/2 bg-primary rounded-r-full top-1/4"></div>
                  )}
                  <item.icon className={cn("h-4 w-4 shrink-0 transition-transform duration-300", isActive ? "text-accent-foreground scale-110" : "group-hover:scale-110")} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-5 border-t border-primary-foreground/10 relative z-10 bg-black/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary-foreground/10 flex items-center justify-center border border-primary-foreground/10 shadow-lg">
              <span className="font-bold text-primary-foreground">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-accent capitalize font-medium">{user?.role || 'Staff'}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-xl text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors border border-transparent"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative bg-background animate-in fade-in duration-500">
        <div className="relative z-10 h-full p-2 md:p-6">
          <div className="glass-panel min-h-full rounded-3xl relative">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"></div>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
