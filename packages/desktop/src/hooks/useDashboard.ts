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
  const [bestSelling, setBestSelling] = useState<BestSellingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setError(null);
    try {
      const todayData = await api.sales.report('daily') as {
        periodData: { sales: number; profit: number; transactions: number };
        topProducts: Array<{ name: string; quantity: number; revenue: number }>;
      };

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const yesterdayData = await api.sales.report('custom', yesterdayStr, yesterdayStr) as {
        periodData: { sales: number; profit: number };
      };

      const calcTrend = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      const products = await api.products.list() as Array<{ id: string; name: string; stock: number }>;
      const lowStockRows = await api.inventory.lowStock() as Array<{ id: string; name: string; stock: number }>;

      setStats({
        todaySales: todayData.periodData.sales,
        todayProfit: todayData.periodData.profit,
        totalProducts: products.length,
        lowStockCount: lowStockRows.length,
        salesTrend: calcTrend(todayData.periodData.sales, yesterdayData.periodData.sales),
        profitTrend: calcTrend(todayData.periodData.profit, yesterdayData.periodData.profit),
      });

      setLowStockItems(lowStockRows.slice(0, 4).map((p) => ({ id: p.id, name: p.name, stock: p.stock })));
      setBestSelling((todayData.topProducts || []).slice(0, 4));

      const recentSales = await api.sales.list({ limit: 4 }) as Array<{
        id: string; total: number; payment_method: string; created_at: string; item_names: string;
      }>;

      setRecentTransactions(recentSales.map((s) => ({
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
