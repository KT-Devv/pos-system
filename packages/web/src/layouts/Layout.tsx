import { NavLink, Outlet, useNavigate } from "react-router-dom";
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
  Menu,
  Bell,
} from "lucide-react";
import { cn } from "@pos/shared/lib/utils";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/sales", icon: ShoppingCart, label: "Sales" },
  { to: "/products", icon: Package, label: "Products" },
  { to: "/inventory", icon: Warehouse, label: "Inventory" },
  { to: "/customers", icon: Users, label: "Customers" },
  { to: "/reports", icon: BarChart3, label: "Reports" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar - hidden on small screens, toggleable */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 bg-primary text-primary-foreground flex flex-col transform transition-transform duration-200 shadow-2xl shadow-primary/10",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:static md:translate-x-0 md:w-64 md:flex"
        )}
        aria-hidden={!mobileOpen && undefined}
      >
        <div className="p-6 border-b border-primary-foreground/10">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-lg shadow-accent/20">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">MomoMart</h1>
              <p className="text-xs text-primary-foreground/55">Retail workspace</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-5 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-accent text-accent-foreground shadow-lg shadow-accent/10"
                    : "text-primary-foreground/65 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-5 border-t border-primary-foreground/10 space-y-3">
          {profile && (
            <div className="flex items-center gap-3 px-2 text-sm">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-foreground/10 font-bold">
                {profile.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 text-primary-foreground/75">
                <p className="font-medium truncate">{profile.name}</p>
                <p className="text-xs opacity-60 capitalize">{profile.role}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground w-full transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Overlay for mobile when sidebar open */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-md hover:bg-primary-foreground/5"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="font-semibold">POS System</h2>
              <div className="text-xs text-muted-foreground">Mom's Shop</div>
              <button aria-label="Notifications" className="rounded-xl p-2 text-muted-foreground hover:bg-muted"><Bell className="h-5 w-5" /></button>
            </div>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
