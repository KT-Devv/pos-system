import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { getLowStockThreshold } from "../lib/settings";

type SaleRow = { total: number; discount: number; sale_items?: { product_id?: string; quantity: number; price: number; cost_price?: number | null }[] };
type ProductRow = { id: string; name: string; stock: number; cost_price?: number | null };
type SaleItemRow = { product_id: string; quantity: number; price: number; cost_price?: number | null };
type SaleSimpleRow = { id: string; total: number; payment_method: string; created_at: string; sale_items?: { product_id: string; quantity: number }[] };

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function calcProfit(sales: SaleRow[], productCosts: Record<string, number> = {}): number {
  return sales.reduce((sum, s) => {
    const itemProfit = (s.sale_items || []).reduce((itemSum, item) => {
      const costValue = Number(item.cost_price ?? 0);
      const fallbackCost = item.product_id ? Number(productCosts[item.product_id] ?? 0) : 0;
      const resolvedCost = costValue > 0 ? costValue : fallbackCost;
      return itemSum + (Number(item.price) - resolvedCost) * item.quantity;
    }, 0);
    const subtotal = (s.sale_items || []).reduce((t, i) => t + Number(i.price) * i.quantity, 0);
    const discount = Number(s.discount) || 0;
    const discountRatio = subtotal > 0 ? discount / subtotal : 0;
    return sum + itemProfit * (1 - discountRatio);
  }, 0);
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
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
      const threshold = getLowStockThreshold();

      const { data: todaySales, error: todayErr } = await supabase
        .from("sales")
        .select("total, discount, sale_items(product_id, quantity, price, cost_price)")
        .gte("created_at", todayStart);
      if (todayErr) throw todayErr;

      const todaySalesData = (todaySales || []) as SaleRow[];
      const todayTotal = todaySalesData.reduce((sum, s) => sum + Number(s.total), 0);

      const productIds = Array.from(new Set(todaySalesData.flatMap((sale) => (sale.sale_items || []).map((item) => item.product_id).filter(Boolean) as string[])));
      const productCostMap: Record<string, number> = {};
      if (productIds.length > 0) {
        const { data: productRows } = await supabase.from("products").select("id, cost_price").in("id", productIds);
        for (const product of (productRows || []) as ProductRow[]) {
          productCostMap[product.id] = Number(product.cost_price ?? 0);
        }
      }

      const todayProfit = calcProfit(todaySalesData, productCostMap);

      const { data: yesterdaySales, error: yErr } = await supabase
        .from("sales")
        .select("total, discount, sale_items(product_id, quantity, price, cost_price)")
        .gte("created_at", yesterdayStart)
        .lt("created_at", todayStart);
      if (yErr) throw yErr;

      const yesterdaySalesData = (yesterdaySales || []) as SaleRow[];
      const yesterdayTotal = yesterdaySalesData.reduce((sum, s) => sum + Number(s.total), 0);
      const yesterdayProductIds = Array.from(new Set(yesterdaySalesData.flatMap((sale) => (sale.sale_items || []).map((item) => item.product_id).filter(Boolean) as string[])));
      const yesterdayProductCostMap: Record<string, number> = {};
      if (yesterdayProductIds.length > 0) {
        const { data: yesterdayProducts } = await supabase.from("products").select("id, cost_price").in("id", yesterdayProductIds);
        for (const product of (yesterdayProducts || []) as ProductRow[]) {
          yesterdayProductCostMap[product.id] = Number(product.cost_price ?? 0);
        }
      }
      const yesterdayProfit = calcProfit(yesterdaySalesData, yesterdayProductCostMap);

      const calcTrend = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      const { data: products, error: pErr } = await supabase.from("products").select("id, name, stock, cost_price");
      if (pErr) throw pErr;

      const allProducts = (products || []) as ProductRow[];
      const lowStockList = allProducts.filter((p) => p.stock > 0 && p.stock <= threshold);
      const outOfStockList = allProducts.filter((p) => p.stock === 0);

      setStats({
        todaySales: todayTotal,
        todayProfit,
        totalProducts: allProducts.length,
        lowStockCount: lowStockList.length + outOfStockList.length,
        salesTrend: calcTrend(todayTotal, yesterdayTotal),
        profitTrend: calcTrend(todayProfit, yesterdayProfit),
      });

      setLowStockItems(
        [...lowStockList, ...outOfStockList].slice(0, 4).map((p) => ({ id: p.id, name: p.name, stock: p.stock }))
      );

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: saleItems, error: siErr } = await supabase
        .from("sale_items")
        .select("product_id, quantity, price, sales!inner(created_at)")
        .gte("sales.created_at", thirtyDaysAgo.toISOString());
      if (siErr) throw siErr;

      const saleItemsData = (saleItems || []) as SaleItemRow[];
      const productSales: Record<string, { qty: number; rev: number }> = {};
      for (const item of saleItemsData) {
        if (!productSales[item.product_id]) productSales[item.product_id] = { qty: 0, rev: 0 };
        productSales[item.product_id].qty += item.quantity;
        productSales[item.product_id].rev += Number(item.price) * item.quantity;
      }

      const topIds = Object.entries(productSales).sort(([, a], [, b]) => b.rev - a.rev).slice(0, 4).map(([id]) => id);
      let nameMap: Record<string, string> = {};
      if (topIds.length > 0) {
        const { data: pData } = await supabase.from("products").select("id, name").in("id", topIds);
        for (const p of pData || []) nameMap[p.id] = p.name;
      }

      setBestSelling(topIds.map((id) => ({
        name: nameMap[id] || "Unknown",
        quantity: productSales[id].qty,
        revenue: productSales[id].rev,
      })));

      const { data: recent, error: rErr } = await supabase
        .from("sales")
        .select("id, total, payment_method, created_at, sale_items(product_id, quantity)")
        .gte("created_at", todayStart)
        .order("created_at", { ascending: false })
        .limit(4);
      if (rErr) throw rErr;

      const recentData = (recent || []) as SaleSimpleRow[];
      const allProductIds = new Set<string>();
      for (const s of recentData) {
        for (const i of s.sale_items || []) allProductIds.add(i.product_id);
      }

      let pnMap: Record<string, string> = {};
      if (allProductIds.size > 0) {
        const { data: pnData } = await supabase.from("products").select("id, name").in("id", [...allProductIds]);
        for (const p of (pnData || []) as ProductRow[]) pnMap[p.id] = p.name;
      }

      setRecentTransactions(recentData.map((s) => ({
        id: s.id,
        items: (s.sale_items || []).slice(0, 2).map((i) => pnMap[i.product_id] || i.product_id).join(", ")
          + ((s.sale_items || []).length > 2 ? " +more" : ""),
        total: Number(s.total),
        created_at: s.created_at,
        payment_method: s.payment_method,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
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
