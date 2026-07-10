import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

type SaleRow = { total: number; discount: number; sale_items?: { quantity: number; price: number; cost_price: number }[] };
type SaleItemRow = { product_id: string; quantity: number; price: number; cost_price: number };
type SaleWithDate = { total: number; discount: number; created_at: string; sale_items?: { quantity: number; price: number; cost_price: number }[] };
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

function calcProfitFromSales(sales: SaleRow[]): number {
  return sales.reduce((sum, s) => {
    const itemProfit = (s.sale_items || []).reduce((itemSum, item) => {
      return itemSum + (Number(item.price) - Number(item.cost_price)) * item.quantity;
    }, 0);
    const subtotal = (s.sale_items || []).reduce((t, i) => t + Number(i.price) * i.quantity, 0);
    const discountRatio = subtotal > 0 ? (Number(s.discount) || 0) / subtotal : 0;
    return sum + itemProfit * (1 - discountRatio);
  }, 0);
}

export function useReports(period: "daily" | "weekly" | "monthly") {
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
      const now = new Date();
      let startDate: Date;

      if (period === "daily") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === "weekly") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const startIso = startDate.toISOString();

      const { data: periodSales, error: psErr } = await supabase
        .from("sales")
        .select("total, discount, sale_items(quantity, price, cost_price)")
        .gte("created_at", startIso);
      if (psErr) throw psErr;

      const periodSalesData = (periodSales || []) as SaleRow[];
      const totalSales = periodSalesData.reduce((sum, s) => sum + Number(s.total), 0);
      const totalTransactions = periodSalesData.length;
      const totalProfit = calcProfitFromSales(periodSalesData);

      setPeriodData({
        sales: totalSales,
        profit: totalProfit,
        transactions: totalTransactions,
        averageSale: totalTransactions > 0 ? totalSales / totalTransactions : 0,
      });

      const { data: items, error: iErr } = await supabase
        .from("sale_items")
        .select("product_id, quantity, price, cost_price, sales!inner(created_at)")
        .gte("sales.created_at", startIso);
      if (iErr) throw iErr;

      const itemsData = (items || []) as SaleItemRow[];
      const prodAgg: Record<string, { qty: number; rev: number; profit: number }> = {};
      for (const item of itemsData) {
        if (!prodAgg[item.product_id]) prodAgg[item.product_id] = { qty: 0, rev: 0, profit: 0 };
        prodAgg[item.product_id].qty += item.quantity;
        prodAgg[item.product_id].rev += Number(item.price) * item.quantity;
        prodAgg[item.product_id].profit += (Number(item.price) - Number(item.cost_price)) * item.quantity;
      }

      const topIds = Object.entries(prodAgg).sort(([, a], [, b]) => b.rev - a.rev).slice(0, 5).map(([id]) => id);
      let nameMap: Record<string, string> = {};
      if (topIds.length > 0) {
        const { data: pData } = await supabase.from("products").select("id, name").in("id", topIds);
        for (const p of (pData || []) as { id: string; name: string }[]) nameMap[p.id] = p.name;
      }

      setTopProducts(topIds.map((id) => ({
        name: nameMap[id] || "Unknown",
        quantity: prodAgg[id].qty,
        revenue: prodAgg[id].rev,
        profit: prodAgg[id].profit,
      })));

      const { data: recentSales, error: rsErr } = await supabase
        .from("sales")
        .select("total, discount, created_at, sale_items(quantity, price, cost_price)")
        .gte("created_at", startIso)
        .order("created_at", { ascending: false });
      if (rsErr) throw rsErr;

      const recentSalesData = (recentSales || []) as SaleWithDate[];
      const dayMap: Record<string, { total: number; profit: number; count: number }> = {};
      for (const s of recentSalesData) {
        const day = s.created_at.split("T")[0];
        if (!dayMap[day]) dayMap[day] = { total: 0, profit: 0, count: 0 };
        dayMap[day].total += Number(s.total);
        dayMap[day].count += 1;
        dayMap[day].profit += calcProfitFromSales([s]);
      }

      setDailySales(
        Object.entries(dayMap)
          .sort(([a], [b]) => b.localeCompare(a))
          .slice(0, 10)
          .map(([date, d]) => ({ date, total: d.total, profit: d.profit, transactions: d.count }))
      );

      const { data: pmSales, error: pmErr } = await supabase
        .from("sales")
        .select("payment_method, total")
        .gte("created_at", startIso);
      if (pmErr) throw pmErr;

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  return { periodData, topProducts, dailySales, paymentMethods, loading, error, refetch: fetchReports };
}
