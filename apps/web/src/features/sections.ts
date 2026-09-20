import {
  BarChart3,
  LayoutDashboard,
  Package,
  Settings as SettingsIcon,
  ShoppingCart,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Section = "sales" | "products" | "inventory" | "customers" | "reports" | "settings";

export const SECTIONS: Record<Section, { title: string; description: string; icon: LucideIcon }> = {
  sales: { title: "Sales", description: "Ring up a sale, take payment, and keep stock accurate.", icon: ShoppingCart },
  products: { title: "Products", description: "Prices, barcodes, categories, and what's on the shelf.", icon: Package },
  inventory: { title: "Inventory", description: "Record stock movements and manage your suppliers.", icon: Truck },
  customers: { title: "Customers", description: "Contact details and loyalty balances for repeat shoppers.", icon: Users },
  reports: { title: "Reports", description: "Revenue, profit, and how customers are paying.", icon: BarChart3 },
  settings: { title: "Settings", description: "Your profile, password, and appearance.", icon: SettingsIcon },
};

/** Sidebar grouping. Settings is pinned separately at the bottom. */
export const NAV_GROUPS: { label: string; items: Section[] }[] = [
  { label: "Sell", items: ["sales"] },
  { label: "Manage", items: ["products", "inventory", "customers"] },
  { label: "Insights", items: ["reports"] },
];

export const MOBILE_NAV: Section[] = ["sales", "products", "inventory", "customers", "reports", "settings"];

/** The dashboard at "/", shown first in the sidebar. */
export const HOME_NAV = { title: "Overview", icon: LayoutDashboard, href: "/" } as const;
