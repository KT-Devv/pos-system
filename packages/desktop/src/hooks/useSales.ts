import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/ipc';

export interface Sale {
  id: string;
  cashier_id: string;
  cashier_name: string;
  total: number;
  discount: number;
  payment_method: string;
  created_at: string;
}

export interface TodayStats {
  totalSales: number;
  netSales: number;
  transactionCount: number;
  profit: number;
}

export function useTodayStats() {
  const [stats, setStats] = useState<TodayStats>({ totalSales: 0, netSales: 0, transactionCount: 0, profit: 0 });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.sales.todayStats();
      setStats(data as TodayStats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, loading, refresh };
}

export function useSalesHistory(limit?: number) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.sales.list({ limit });
      setSales(data as Sale[]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sales, loading, refresh };
}
