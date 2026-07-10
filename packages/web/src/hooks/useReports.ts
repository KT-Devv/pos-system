import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

type SaleRow = { total: number; sale_items?: { quantity: number; price: number; cost_price: number }[] };
type SaleItemRow = { product_id: string; quantity: number; price: number; cost_price: number };
type SaleWithDate = { total: number; created_at: string; sale_items?: { quantity: number; price: number; cost_price: number }[] };
type PaymentRow = { payment_method: string; total: number };

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

export function useReports(period: "daily" | "weekly" | "monthly") {
  const [periodData, setPeriodData] = useState<PeriodData>({ sales: 0, profit: 0, transactions: 0, averageSale: 0 });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [dailySales, setDailySales] = useState<DailySaleSummary[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;

      if (period === "daily") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === "weekly") {
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const startIso = startDate.toISOString();

      // Period sales data
      const { data: periodSales } = await supabase
        .from("sales")
        .select("total, sale_items(quantity, price, cost_price)")
        .gte("created_at", startIso);

      const periodSalesData = (periodSales || []) as SaleRow[];
      const totalSales = periodSalesData.reduce((sum, s) => sum + Number(s.total), 0);
      const totalTransactions = periodSalesData.length;
      const totalProfit = periodSalesData.reduce((sum, s) => {
        return sum + (s.sale_items || []).reduce((itemSum, item) => {
          return itemSum + (Number(item.price) - Number(item.cost_price)) * item.quantity;
        }, 0);
      }, 0);

      setPeriodData({
        sales: totalSales,
        profit: totalProfit,
        transactions: totalTransactions,
        averageSale: totalTransactions > 0 ? totalSales / totalTransactions : 0,
      });

      // Top products this period
      const { data: items } = await supabase
        .from("sale_items")
        .select("product_id, quantity, price, cost_price, sales!inner(created_at)")
        .gte("sales.created_at", startIso);

      const itemsData = (items || []) as SaleItemRow[];
      const prodAgg: Record<string, { qty: number; rev: number; profit: number }> = {};
      for (const item of itemsData) {
        if (!prodAgg[item.product_id]) prodAgg[item.product_id] = { qty: 0, rev: 0, profit: 0 };
        prodAgg[item.product_id].qty += item.quantity;
        prodAgg[item.product_id].rev += Number(item.price) * item.quantity;
        prodAgg[item.product_id].profit += (Number(item.price) - Number(item.cost_price)) * item.quantity;
      }

      const topIds = Object.entries(prodAgg)
        .sort(([, a], [, b]) => b.rev - a.rev)
        .slice(0, 5)
        .map(([id]) => id);

      let nameMap: Record<string, string> = {};
      if (topIds.length > 0) {
        const { data: pData } = await supabase
          .from("products")
          .select("id, name")
          .in("id", topIds);
        for (const p of (pData || []) as { id: string; name: string }[]) nameMap[p.id] = p.name;
      }

      setTopProducts(
        topIds.map((id) => ({
          name: nameMap[id] || "Unknown",
          quantity: prodAgg[id].qty,
          revenue: prodAgg[id].rev,
          profit: prodAgg[id].profit,
        }))
      );

      // Daily sales summary (last 5 days)
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const { data: recentSales } = await supabase
        .from("sales")
        .select("total, created_at, sale_items(quantity, price, cost_price)")
        .gte("created_at", fiveDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      const recentSalesData = (recentSales || []) as SaleWithDate[];
      const dayMap: Record<string, { total: number; profit: number; count: number }> = {};
      for (const s of recentSalesData) {
        const day = s.created_at.split("T")[0];
        if (!dayMap[day]) dayMap[day] = { total: 0, profit: 0, count: 0 };
        dayMap[day].total += Number(s.total);
        dayMap[day].count += 1;
        dayMap[day].profit += (s.sale_items || []).reduce((sum, item) => {
          return sum + (Number(item.price) - Number(item.cost_price)) * item.quantity;
        }, 0);
      }

      setDailySales(
        Object.entries(dayMap)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, d]) => ({ date, total: d.total, profit: d.profit, transactions: d.count }))
      );

      // Payment method breakdown
      const { data: pmSales } = await supabase
        .from("sales")
        .select("payment_method, total")
        .gte("created_at", startIso);

      const pmSalesData = (pmSales || []) as PaymentRow[];
      const pmMap: Record<string, number> = {};
      for (const s of pmSalesData) {
        pmMap[s.payment_method] = (pmMap[s.payment_method] || 0) + Number(s.total);
      }

      const pmTotal = Object.values(pmMap).reduce((a, b) => a + b, 0);
      setPaymentMethods(
        Object.entries(pmMap).map(([method, amount]) => ({
          method: method === "momo" ? "Mobile Money" : method.charAt(0).toUpperCase() + method.slice(1),
          amount,
          percentage: pmTotal > 0 ? Math.round((amount / pmTotal) * 100) : 0,
        }))
      );
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return { periodData, topProducts, dailySales, paymentMethods, loading, refetch: fetchReports };
}
