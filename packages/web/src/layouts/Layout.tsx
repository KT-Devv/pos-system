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
} from "lucide-react";
import { cn } from "@pos/shared/lib/utils";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/useSettings";

const allNavItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", adminOnly: false },
  { to: "/sales", icon: ShoppingCart, label: "Sales", adminOnly: false },
  { to: "/products", icon: Package, label: "Products", adminOnly: true },
  { to: "/inventory", icon: Warehouse, label: "Inventory", adminOnly: true },
  { to: "/customers", icon: Users, label: "Customers", adminOnly: false },
  { to: "/reports", icon: BarChart3, label: "Reports", adminOnly: true },
  { to: "/settings", icon: Settings, label: "Settings", adminOnly: true },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile, logout, isAdmin } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const navItems = allNavItems.filter((item) => !item.adminOnly || isAdmin);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-primary text-primary-foreground flex flex-col transform transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:static md:translate-x-0 md:w-64 md:flex"
        )}
      >
        <div className="p-6 border-b border-primary-foreground/20">
          <h1 className="text-xl font-bold">POS System</h1>
          <p className="text-sm opacity-70">{settings.shopName}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-primary-foreground/20 space-y-2">
          {profile && (
            <div className="px-3 text-sm text-primary-foreground/70">
              <p className="font-medium truncate">{profile.name}</p>
              <p className="text-xs opacity-60 capitalize">{profile.role}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground w-full transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      <main className="flex-1 overflow-auto">
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-white">
          <div className="flex items-center gap-3">
            <button aria-label="Open menu" onClick={() => setMobileOpen(true)} className="p-2 rounded-md hover:bg-primary-foreground/5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5h14a1 1 0 110 2H3a1 1 0 110-2zm0 4h14a1 1 0 110 2H3a1 1 0 110-2zm0 4h14a1 1 0 110 2H3a1 1 0 110-2z" clipRule="evenodd" />
              </svg>
            </button>
            <div>
              <h2 className="font-semibold">POS System</h2>
              <div className="text-xs text-muted-foreground">{settings.shopName}</div>
            </div>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
