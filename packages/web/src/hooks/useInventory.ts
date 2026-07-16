import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { getLowStockThreshold } from "../lib/settings";

export interface StockHistoryRow {
  id: string;
  product_id: string;
  type: "in" | "out" | "adjustment";
  quantity: number;
  supplier_id: string | null;
  notes: string | null;
  created_at: string;
  products?: { id: string; name: string } | null;
  suppliers?: { id: string; name: string } | null;
}

export interface SupplierRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
}

export function useStockHistory() {
  const [stockHistory, setStockHistory] = useState<StockHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStockHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("stock_history")
        .select("*, products(id, name), suppliers(id, name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStockHistory(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stock history");
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchStockHistory();
      setLoading(false);
    };
    init();
  }, [fetchStockHistory]);

  return { stockHistory, loading, error, refetch: fetchStockHistory };
}

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("suppliers")
      .select("*")
      .order("name");
    setSuppliers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  return { suppliers, loading, refetch: fetchSuppliers };
}

export function useCreateStockEntry() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createStockEntry = useCallback(async (entry: {
    product_id: string;
    type: "in" | "out" | "adjustment";
    quantity: number;
    supplier_id?: string | null;
    notes?: string | null;
    measurement_unit?: string | null;
    pack_quantity?: number | null;
    unit_cost?: number | null;
  }) => {
    setCreating(true);
    setError(null);
    try {
      const detailParts = [
        entry.measurement_unit?.trim() || null,
        entry.pack_quantity ? `pack ${entry.pack_quantity}` : null,
        entry.unit_cost != null ? `unit cost ${entry.unit_cost}` : null,
      ].filter(Boolean) as string[];
      const detailText = detailParts.length > 0 ? detailParts.join(" • ") : null;
      const noteText = [entry.notes?.trim() || null, detailText].filter(Boolean).join(" • ");

      const { error: insertError } = await supabase.from("stock_history").insert({
        product_id: entry.product_id,
        type: entry.type,
        quantity: Math.abs(entry.quantity || 0),
        supplier_id: entry.supplier_id || null,
        notes: noteText || null,
      });
      if (insertError) throw insertError;

      if (entry.type === "in") {
        const { data: productData, error: fetchError } = await supabase
          .from("products")
          .select("stock, cost_price")
          .eq("id", entry.product_id)
          .single();
        if (fetchError) throw fetchError;

        const currentStock = Number(productData?.stock ?? 0);
        const currentCost = Number(productData?.cost_price ?? 0);
        const nextStock = currentStock + Math.abs(entry.quantity || 0);
        const nextCost = entry.unit_cost != null && entry.unit_cost >= 0 ? Number(entry.unit_cost) : currentCost;

        const { error: updateError } = await supabase
          .from("products")
          .update({ stock: nextStock, cost_price: nextCost })
          .eq("id", entry.product_id);
        if (updateError) throw updateError;
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create stock entry");
      return false;
    } finally {
      setCreating(false);
    }
  }, []);

  return { createStockEntry, creating, error };
}

export function useInventoryStats() {
  const [stats, setStats] = useState({ totalProducts: 0, lowStock: 0, outOfStock: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data, error } = await supabase.from("products").select("stock");
        if (error) throw error;
        const products = (data || []) as { stock: number }[];
        setStats({
          totalProducts: products.length,
          lowStock: products.filter((p) => p.stock > 0 && p.stock <= getLowStockThreshold()).length,
          outOfStock: products.filter((p) => p.stock === 0).length,
        });
      } catch {
        // keep defaults
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { stats, loading };
}
