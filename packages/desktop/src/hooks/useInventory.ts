import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/ipc';

export interface StockEntry {
  id: string;
  product_id: string;
  product_name: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  supplier_id: string | null;
  supplier_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  category_name: string | null;
}

export function useStockHistory(productId?: string) {
  const [history, setHistory] = useState<StockEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.inventory.history({ product_id: productId, limit: 100 });
      setHistory(data as StockEntry[]);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { history, loading, refresh };
}

export function useLowStock() {
  const [items, setItems] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.inventory.lowStock();
      setItems(data as LowStockProduct[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, loading, refresh };
}
