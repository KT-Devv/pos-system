import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/ipc';

interface DashboardStats {
  todaySales: number;
  todayProfit: number;
  totalProducts: number;
  lowStockCount: number;
  salesTrend: number;
  profitTrend: number;
}

interface RecentTransaction {
  id: string;
  items: string;
  total: number;
  created_at: string;
  payment_method: string;
}

interface LowStockItem {
  id: string;
  name: string;
  stock: number;
}

interface BestSellingProduct {
  name: string;
  quantity: number;
  revenue: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0, todayProfit: 0, totalProducts: 0, lowStockCount: 0, salesTrend: 0, profitTrend: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [bestSelling] = useState<BestSellingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setError(null);
    try {
      const [todayResult, statsResult, products, lowStockRows, recentSales] = await Promise.all([
        api.sales.todayStats().catch(() => ({ totalSales: 0, profit: 0, transactionCount: 0 })),
        api.sales.stats('daily').catch(() => []),
        api.products.list().catch(() => []),
        api.inventory.lowStock().catch(() => []),
        api.sales.list({ limit: 4 }).catch(() => []),
      ]);

      const todaySales = todayResult.totalSales || 0;
      const todayProfit = todayResult.profit || 0;

      let salesTrend = 0;
      let profitTrend = 0;
      if (statsResult.length >= 2) {
        const yesterdayEntry = statsResult[1];
        const ydSales = yesterdayEntry?.totalSales || 0;
        const ydProfit = yesterdayEntry?.profit || 0;
        salesTrend = ydSales > 0 ? Math.round(((todaySales - ydSales) / ydSales) * 100) : todaySales > 0 ? 100 : 0;
        profitTrend = ydProfit > 0 ? Math.round(((todayProfit - ydProfit) / ydProfit) * 100) : todayProfit > 0 ? 100 : 0;
      }

      setStats({
        todaySales,
        todayProfit,
        totalProducts: products.length,
        lowStockCount: lowStockRows.length,
        salesTrend,
        profitTrend,
      });

      setLowStockItems(lowStockRows.slice(0, 4).map((p: any) => ({ id: p.id, name: p.name, stock: p.stock })));
      setRecentTransactions(recentSales.map((s: any) => ({
        id: s.id,
        items: s.item_names ? s.item_names.split(', ').slice(0, 2).join(', ') + (s.item_names.split(', ').length > 2 ? ' +more' : '') : 'Unknown items',
        total: Number(s.total),
        created_at: s.created_at,
        payment_method: s.payment_method,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  return {
    stats, recentTransactions, lowStockItems, bestSelling,
    loading, error, refetch: fetchDashboard, formatTimeAgo: timeAgo,
  };
}
