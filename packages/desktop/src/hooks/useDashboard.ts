import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/ipc';

type SaleRow = { id: string; total: number; payment_method: string; created_at: string; item_names?: string | null };

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

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr.replace(' ', 'T') + 'Z').getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
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
      const now = new Date();
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      const [todayReport, yesterdayReport, monthReport, products, lowStock, recentSales] = await Promise.all([
        api.sales.report('daily'),
        api.sales.report('custom', formatDate(yesterday), formatDate(yesterday)),
        api.sales.report('custom', formatDate(thirtyDaysAgo), formatDate(now)),
        api.products.list(),
        api.inventory.lowStock(),
        api.sales.list({ limit: 4 }),
      ]);

      const todayData = todayReport as { periodData: { sales: number; profit: number; transactions: number }; topProducts?: BestSellingProduct[] };
      const yesterdayData = yesterdayReport as { periodData: { sales: number; profit: number } };
      const monthData = monthReport as { topProducts?: BestSellingProduct[] };
      const productRows = (products || []) as ProductRow[];
      const lowStockRows = (lowStock || []) as ProductRow[];
      const recentRows = (recentSales || []) as SaleRow[];
      const trend = (current: number, previous: number) => previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 100);

      setStats({
        todaySales: Number(todayData.periodData.sales ?? 0),
        todayProfit: Number(todayData.periodData.profit ?? 0),
        totalProducts: productRows.length,
        lowStockCount: lowStockRows.length,
        salesTrend: trend(Number(todayData.periodData.sales ?? 0), Number(yesterdayData.periodData.sales ?? 0)),
        profitTrend: trend(Number(todayData.periodData.profit ?? 0), Number(yesterdayData.periodData.profit ?? 0)),
      });

      setLowStockItems(lowStockRows.slice(0, 4).map((item) => ({ id: item.id, name: item.name, stock: Number(item.stock ?? 0) })));
      setBestSelling((monthData.topProducts || todayData.topProducts || []).slice(0, 4));
      setRecentTransactions(recentRows.map((sale) => ({
        id: sale.id,
        items: sale.item_names || 'Sale',
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
    formatTimeAgo: timeAgo,
  };
}
