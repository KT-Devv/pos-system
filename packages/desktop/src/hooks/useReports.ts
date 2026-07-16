import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/ipc';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface SalesQueryOptions {
  period?: ReportPeriod;
  startDate?: string;
  endDate?: string;
}

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

export async function querySalesSummary(options: SalesQueryOptions = {}) {
  const period = options.period ?? 'daily';
  const data = await api.sales.stats(period);
  const stats = Array.isArray(data) ? data : [];
  return {
    periodData: {
      sales: stats.reduce((sum: number, item: any) => sum + Number(item.totalSales ?? 0), 0),
      profit: 0,
      transactions: stats.reduce((sum: number, item: any) => sum + Number(item.transactionCount ?? 0), 0),
      averageSale: 0,
    },
    topProducts: [] as TopProduct[],
    dailySales: stats.map((item: any) => ({
      date: item.period,
      total: Number(item.totalSales ?? 0),
      profit: 0,
      transactions: Number(item.transactionCount ?? 0),
    })),
    paymentMethods: [] as PaymentMethodSummary[],
  };
}

export function useReports(period: ReportPeriod, startDate?: string, endDate?: string) {
  const [periodData, setPeriodData] = useState<PeriodData>({ sales: 0, profit: 0, transactions: 0, averageSale: 0 });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [dailySales, setDailySales] = useState<DailySaleSummary[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await querySalesSummary({ period, startDate, endDate });
      setPeriodData(result.periodData);
      setTopProducts(result.topProducts);
      setDailySales(result.dailySales);
      setPaymentMethods(result.paymentMethods);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return { periodData, topProducts, dailySales, paymentMethods, loading, error, refetch: fetchReports };
}
