import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/ipc';
import type { StockHistory, Supplier } from '@pos/shared/types';

export function useStockHistory() {
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStockHistory = useCallback(async () => {
    try {
      const data = await api.inventory.history() as StockHistory[];
      setStockHistory(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stock history');
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    const data = await api.suppliers.list() as Supplier[];
    setSuppliers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  return { suppliers, loading, refetch: fetchSuppliers };
}

export function useInventoryStats() {
  const [stats, setStats] = useState({ totalProducts: 0, lowStock: 0, outOfStock: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const productStats = await api.products.stats() as { total: number; lowStock: number; outOfStock: number };
        setStats({ totalProducts: productStats.total, lowStock: productStats.lowStock, outOfStock: productStats.outOfStock });
      } catch {
        // keep defaults
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { stats, loading };
}

export function useCreateStockEntry() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createStockEntry = useCallback(async (entry: {
    product_id: string;
    type: 'in' | 'out' | 'adjustment';
    quantity: number;
    supplier_id?: string | null;
    notes?: string | null;
  }) => {
    setCreating(true);
    setError(null);
    try {
      if (entry.type === 'in') {
        await api.inventory.stockIn({
          product_id: entry.product_id,
          quantity: Math.abs(entry.quantity),
          supplier_id: entry.supplier_id || undefined,
          notes: entry.notes || undefined,
        });
      } else if (entry.type === 'out') {
        await api.inventory.stockOut({
          product_id: entry.product_id,
          quantity: Math.abs(entry.quantity),
          notes: entry.notes || undefined,
        });
      } else {
        await api.inventory.adjust({
          product_id: entry.product_id,
          quantity: entry.quantity,
          notes: entry.notes || undefined,
        });
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create stock entry');
      return false;
    } finally {
      setCreating(false);
    }
  }, []);

  return { createStockEntry, creating, error };
}
