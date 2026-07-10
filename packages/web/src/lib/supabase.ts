import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase environment variables. " +
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file."
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: "admin" | "cashier";
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          role?: "admin" | "cashier";
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: "admin" | "cashier";
          created_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          name: string;
          category_id: string | null;
          cost_price: number;
          selling_price: number;
          stock: number;
          barcode: string | null;
          image: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category_id?: string | null;
          cost_price: number;
          selling_price: number;
          stock?: number;
          barcode?: string | null;
          image?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category_id?: string | null;
          cost_price?: number;
          selling_price?: number;
          stock?: number;
          barcode?: string | null;
          image?: string | null;
          created_at?: string;
        };
      };
      sales: {
        Row: {
          id: string;
          cashier_id: string;
          total: number;
          discount: number;
          payment_method: "cash" | "momo" | "card";
          created_at: string;
        };
        Insert: {
          id?: string;
          cashier_id: string;
          total: number;
          discount?: number;
          payment_method: "cash" | "momo" | "card";
          created_at?: string;
        };
        Update: {
          id?: string;
          cashier_id?: string;
          total?: number;
          discount?: number;
          payment_method?: "cash" | "momo" | "card";
          created_at?: string;
        };
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string;
          quantity: number;
          price: number;
          cost_price: number;
        };
        Insert: {
          id?: string;
          sale_id: string;
          product_id: string;
          quantity: number;
          price: number;
          cost_price: number;
        };
        Update: {
          id?: string;
          sale_id?: string;
          product_id?: string;
          quantity?: number;
          price?: number;
          cost_price?: number;
        };
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          created_at?: string;
        };
      };
      stock_history: {
        Row: {
          id: string;
          product_id: string;
          type: "in" | "out" | "adjustment";
          quantity: number;
          supplier_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          type: "in" | "out" | "adjustment";
          quantity: number;
          supplier_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          type?: "in" | "out" | "adjustment";
          quantity?: number;
          supplier_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          title: string;
          amount: number;
          category: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          amount: number;
          category: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          amount?: number;
          category?: string;
          notes?: string | null;
          created_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          loyalty_points: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          loyalty_points?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          loyalty_points?: number;
          created_at?: string;
        };
      };
    };
  };
};
