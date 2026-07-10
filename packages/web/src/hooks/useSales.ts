import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

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
      const { data: saleId, error: rpcError } = await supabase.rpc("create_sale", {
        p_cashier_id: cashierId,
        p_total: total,
        p_discount: discount,
        p_payment_method: paymentMethod,
        p_items: items,
      });

      if (rpcError) throw rpcError;

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
