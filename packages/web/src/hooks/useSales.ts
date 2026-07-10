import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface SaleRow {
  id: string;
  cashier_id: string;
  total: number;
  discount: number;
  payment_method: "cash" | "momo" | "card";
  created_at: string;
  users?: { name: string } | null;
  sale_items?: {
    id: string;
    product_id: string;
    quantity: number;
    price: number;
  }[];
}

export function useRecentSales(limit = 5) {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSales = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("sales")
        .select("*, users(name), sale_items(id, product_id, quantity, price)")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      setSales(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch sales");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  return { sales, loading, error, refetch: fetchSales };
}

export function useCreateSale() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSale = useCallback(async (
    cashierId: string,
    items: { product_id: string; quantity: number; price: number; cost_price: number }[],
    total: number,
    discount: number,
    paymentMethod: "cash" | "momo" | "card"
  ) => {
    setCreating(true);
    setError(null);
    try {
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          cashier_id: cashierId,
          total,
          discount,
          payment_method: paymentMethod,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      const saleItems = items.map((item) => ({
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        cost_price: item.cost_price,
      }));

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(saleItems);

      if (itemsError) throw itemsError;

      return sale;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create sale");
      return null;
    } finally {
      setCreating(false);
    }
  }, []);

  return { createSale, creating, error };
}
