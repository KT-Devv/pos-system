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

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("*")
        .order("name");
      setSuppliers(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  return { suppliers, loading };
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
  }) => {
    setCreating(true);
    setError(null);
    try {
      const { error } = await supabase.from("stock_history").insert(entry);
      if (error) throw error;
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
