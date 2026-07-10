export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type TableDef<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      users: TableDef<
        { id: string; name: string; email: string; role: "admin" | "cashier"; created_at: string },
        { id: string; name: string; email: string; role?: "admin" | "cashier"; created_at?: string },
        { id?: string; name?: string; email?: string; role?: "admin" | "cashier"; created_at?: string }
      >;
      categories: TableDef<
        { id: string; name: string; created_at: string },
        { id?: string; name: string; created_at?: string },
        { id?: string; name?: string; created_at?: string }
      >;
      products: TableDef<
        { id: string; name: string; category_id: string | null; cost_price: number; selling_price: number; stock: number; barcode: string | null; image: string | null; created_at: string },
        { id?: string; name: string; category_id?: string | null; cost_price: number; selling_price: number; stock?: number; barcode?: string | null; image?: string | null; created_at?: string },
        { id?: string; name?: string; category_id?: string | null; cost_price?: number; selling_price?: number; stock?: number; barcode?: string | null; image?: string | null; created_at?: string }
      >;
      sales: TableDef<
        { id: string; cashier_id: string; total: number; discount: number; payment_method: "cash" | "momo" | "card"; created_at: string },
        { id?: string; cashier_id: string; total: number; discount?: number; payment_method: "cash" | "momo" | "card"; created_at?: string },
        { id?: string; cashier_id?: string; total?: number; discount?: number; payment_method?: "cash" | "momo" | "card"; created_at?: string }
      >;
      sale_items: TableDef<
        { id: string; sale_id: string; product_id: string; quantity: number; price: number; cost_price: number },
        { id?: string; sale_id: string; product_id: string; quantity: number; price: number; cost_price: number },
        { id?: string; sale_id?: string; product_id?: string; quantity?: number; price?: number; cost_price?: number }
      >;
      suppliers: TableDef<
        { id: string; name: string; phone: string | null; email: string | null; address: string | null; created_at: string },
        { id?: string; name: string; phone?: string | null; email?: string | null; address?: string | null; created_at?: string },
        { id?: string; name?: string; phone?: string | null; email?: string | null; address?: string | null; created_at?: string }
      >;
      stock_history: TableDef<
        { id: string; product_id: string; type: "in" | "out" | "adjustment"; quantity: number; supplier_id: string | null; notes: string | null; created_at: string },
        { id?: string; product_id: string; type: "in" | "out" | "adjustment"; quantity: number; supplier_id?: string | null; notes?: string | null; created_at?: string },
        { id?: string; product_id?: string; type?: "in" | "out" | "adjustment"; quantity?: number; supplier_id?: string | null; notes?: string | null; created_at?: string }
      >;
      expenses: TableDef<
        { id: string; title: string; amount: number; category: string; notes: string | null; created_at: string },
        { id?: string; title: string; amount: number; category: string; notes?: string | null; created_at?: string },
        { id?: string; title?: string; amount?: number; category?: string; notes?: string | null; created_at?: string }
      >;
      customers: TableDef<
        { id: string; name: string; phone: string | null; email: string | null; loyalty_points: number; created_at: string },
        { id?: string; name: string; phone?: string | null; email?: string | null; loyalty_points?: number; created_at?: string },
        { id?: string; name?: string; phone?: string | null; email?: string | null; loyalty_points?: number; created_at?: string }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      create_sale: {
        Args: {
          p_cashier_id: string;
          p_total: number;
          p_discount: number;
          p_payment_method: string;
          p_items: Json;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
