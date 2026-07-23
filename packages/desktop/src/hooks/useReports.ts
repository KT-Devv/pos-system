import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/ipc';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface PeriodData {
  sales: number;
  profit: number;
  transactions: number;
  averageSale: number;
}

export interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
  profit: number;
}

export interface DailySaleSummary {
  date: string;
  total: number;
  profit: number;
  transactions: number;
}

export interface PaymentMethodSummary {
  method: string;
  amount: number;
  percentage: number;
}

export function useReports(period: ReportPeriod) {
  const [periodData, setPeriodData] = useState<PeriodData>({ sales: 0, profit: 0, transactions: 0, averageSale: 0 });
  const [topProducts] = useState<TopProduct[]>([]);
  const [dailySales, setDailySales] = useState<DailySaleSummary[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsResult, todayResult, recentSales] = await Promise.all([
        api.sales.stats(period).catch(() => []),
        api.sales.todayStats().catch(() => ({ totalSales: 0, profit: 0, transactionCount: 0 })),
        api.sales.list({ limit: 50 }).catch(() => []),
      ]);

      const totalSales = statsResult.reduce((sum: number, s: any) => sum + (s.totalSales || 0), 0);
      const totalTransactions = statsResult.reduce((sum: number, s: any) => sum + (s.transactionCount || 0), 0);

      setPeriodData({
        sales: todayResult.totalSales || totalSales,
        profit: todayResult.profit || 0,
        transactions: todayResult.transactionCount || totalTransactions,
        averageSale: totalTransactions > 0 ? totalSales / totalTransactions : 0,
      });

      setDailySales(statsResult.map((s: any) => ({
        date: s.period,
        total: s.totalSales || 0,
        profit: 0,
        transactions: s.transactionCount || 0,
      })));

      const methodMap = new Map<string, number>();
      for (const sale of recentSales) {
        const method = sale.payment_method || 'unknown';
        methodMap.set(method, (methodMap.get(method) || 0) + Number(sale.total || 0));
      }
      const totalMethodSales = Array.from(methodMap.values()).reduce((a, b) => a + b, 0);
      setPaymentMethods(Array.from(methodMap.entries()).map(([method, amount]) => ({
        method,
        amount,
        percentage: totalMethodSales > 0 ? Math.round((amount / totalMethodSales) * 100) : 0,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  return { periodData, topProducts, dailySales, paymentMethods, loading, error, refetch: fetchReports };
}
