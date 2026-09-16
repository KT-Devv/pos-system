import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface SaleRow {
  id: string;
  cashier_id: string;
  total: number;
  discount: number;
  payment_method: "cash" | "momo" | "card";
  created_at: string;
  profiles?: { name: string } | null;
  sale_lines?: {
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
        .select("*, profiles(name), sale_lines(id, product_id, quantity, price:unit_price)")
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
    _total: number,
    discount: number,
    paymentMethod: "cash" | "momo" | "card"
  ) => {
    setCreating(true);
    setError(null);
    try {
      const { data: saleId, error } = await supabase.rpc("create_sale", {
        p_cashier_id: cashierId,
        p_customer_id: null,
        p_payment_method: paymentMethod,
        p_discount: discount,
        p_lines: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      });
      if (error) throw error;

      const { data: sale, error: fetchError } = await supabase
        .from("sales")
        .select("*")
        .eq("id", saleId)
        .single();
      if (fetchError) throw fetchError;
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
