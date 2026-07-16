import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/ipc';

type SaleRow = { id: string; total: number; payment_method: string; created_at: string };

type ProductRow = { id: string; name: string; stock: number };

export interface DashboardStats {
  todaySales: number;
  todayProfit: number;
  totalProducts: number;
  lowStockCount: number;
  salesTrend: number;
  profitTrend: number;
}

export interface RecentTransaction {
  id: string;
  items: string;
  total: number;
  created_at: string;
  payment_method: string;
}

export interface LowStockItem {
  id: string;
  name: string;
  stock: number;
}

export interface BestSellingProduct {
  name: string;
  quantity: number;
  revenue: number;
}

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayProfit: 0,
    totalProducts: 0,
    lowStockCount: 0,
    salesTrend: 0,
    profitTrend: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [bestSelling, setBestSelling] = useState<BestSellingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [todayStats, products, lowStock, recentSales] = await Promise.all([
        api.sales.todayStats(),
        api.products.list(),
        api.inventory.lowStock(),
        api.sales.list({ limit: 4 }),
      ]);

      const productRows = (products || []) as ProductRow[];
      const lowStockRows = (lowStock || []) as ProductRow[];
      const recentRows = (recentSales || []) as SaleRow[];

      setStats({
        todaySales: Number((todayStats as { totalSales?: number }).totalSales ?? 0),
        todayProfit: Number((todayStats as { profit?: number }).profit ?? 0),
        totalProducts: productRows.length,
        lowStockCount: lowStockRows.length,
        salesTrend: 0,
        profitTrend: 0,
      });

      setLowStockItems(lowStockRows.slice(0, 4).map((item) => ({ id: item.id, name: item.name, stock: Number(item.stock ?? 0) })));
      setBestSelling([]);
      setRecentTransactions(recentRows.map((sale) => ({
        id: sale.id,
        items: 'Sale',
        total: Number(sale.total ?? 0),
        created_at: sale.created_at,
        payment_method: sale.payment_method,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    stats,
    recentTransactions,
    lowStockItems,
    bestSelling,
    loading,
    error,
    refetch: fetchDashboard,
  };
}
