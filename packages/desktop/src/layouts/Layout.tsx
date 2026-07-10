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
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-primary text-primary-foreground flex flex-col drag-region">
        <div className="p-6 border-b border-primary-foreground/20 no-drag">
          <h1 className="text-xl font-bold">POS System</h1>
          <p className="text-sm opacity-70">Welcome, {user?.name || 'User'}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 no-drag">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary-foreground/15 text-primary-foreground shadow-sm'
                    : 'text-primary-foreground/60 hover:bg-primary-foreground/8 hover:text-primary-foreground hover:translate-x-0.5'
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-primary-foreground/20 no-drag">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium">{user?.name || 'User'}</p>
              <p className="text-xs opacity-60 capitalize">{user?.role || ''}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-md hover:bg-primary-foreground/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto no-drag">
        <Outlet />
      </main>
    </div>
  );
}
