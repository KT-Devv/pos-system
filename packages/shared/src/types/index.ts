export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "cashier";
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category_id: string | null;
  cost_price: number;
  selling_price: number;
  stock: number;
  barcode: string | null;
  image_url: string | null;
  created_at: string;
}

export interface ProductWithCategory extends Product {
  categories?: Category;
}

export interface Sale {
  id: string;
  cashier_id: string;
  customer_id: string | null;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: "cash" | "momo" | "card";
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
}

export interface SaleWithItems extends Sale {
  sale_items: SaleItem[];
  users?: User;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
}

export interface StockHistory {
  id: string;
  product_id: string;
  type: "in" | "out" | "adjustment";
  quantity: number;
  supplier_id: string | null;
  notes: string | null;
  created_at: string;
}

export type StockMovement = StockHistory;

export interface StockHistoryWithDetails extends StockHistory {
  products?: Product;
  suppliers?: Supplier;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  notes: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  loyalty_points: number;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface DailySales {
  date: string;
  total: number;
  count: number;
}

export interface DailyProfit {
  date: string;
  profit: number;
}

export type PaymentMethod = "cash" | "momo" | "card";

export type UserRole = "admin" | "cashier";
