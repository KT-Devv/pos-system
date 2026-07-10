import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

type SaleRow = { total: number; sale_items?: { quantity: number; price: number; cost_price: number }[] };
type ProductRow = { id: string; name: string; stock: number };
type SaleItemRow = { product_id: string; quantity: number; price: number };
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
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day ago`;
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

  const fetchDashboard = useCallback(async () => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();

      // Today's sales
      const { data: todaySales } = await supabase
        .from("sales")
        .select("total, sale_items(quantity, price, cost_price)")
        .gte("created_at", todayStart);

      const todaySalesData = (todaySales || []) as SaleRow[];
      const todayTotal = todaySalesData.reduce((sum, s) => sum + Number(s.total), 0);
      const todayProfit = todaySalesData.reduce((sum, s) => {
        return sum + (s.sale_items || []).reduce((itemSum, item) => {
          return itemSum + (Number(item.price) - Number(item.cost_price)) * item.quantity;
        }, 0);
      }, 0);

      // Yesterday's sales for trend
      const { data: yesterdaySales } = await supabase
        .from("sales")
        .select("total, sale_items(quantity, price, cost_price)")
        .gte("created_at", yesterdayStart)
        .lt("created_at", todayStart);

      const yesterdaySalesData = (yesterdaySales || []) as SaleRow[];
      const yesterdayTotal = yesterdaySalesData.reduce((sum, s) => sum + Number(s.total), 0);
      const yesterdayProfit = yesterdaySalesData.reduce((sum, s) => {
        return sum + (s.sale_items || []).reduce((itemSum, item) => {
          return itemSum + (Number(item.price) - Number(item.cost_price)) * item.quantity;
        }, 0);
      }, 0);

      const calcTrend = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      // Products
      const { data: products } = await supabase.from("products").select("id, name, stock");
      const allProducts = (products || []) as ProductRow[];
      const lowStockList = allProducts.filter((p) => p.stock > 0 && p.stock <= 10);
      const outOfStockList = allProducts.filter((p) => p.stock === 0);

      setStats({
        todaySales: todayTotal,
        todayProfit: todayProfit,
        totalProducts: allProducts.length,
        lowStockCount: lowStockList.length + outOfStockList.length,
        salesTrend: calcTrend(todayTotal, yesterdayTotal),
        profitTrend: calcTrend(todayProfit, yesterdayProfit),
      });

      setLowStockItems(
        [...lowStockList, ...outOfStockList].slice(0, 4).map((p: ProductRow) => ({
          id: p.id,
          name: p.name,
          stock: p.stock,
        }))
      );

      // Best selling (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: saleItems } = await supabase
        .from("sale_items")
        .select("product_id, quantity, price, sales!inner(created_at)")
        .gte("sales.created_at", thirtyDaysAgo.toISOString());

      const saleItemsData = (saleItems || []) as SaleItemRow[];
      const productSales: Record<string, { qty: number; rev: number }> = {};
      for (const item of saleItemsData) {
        if (!productSales[item.product_id]) productSales[item.product_id] = { qty: 0, rev: 0 };
        productSales[item.product_id].qty += item.quantity;
        productSales[item.product_id].rev += Number(item.price) * item.quantity;
      }

      const topIds = Object.entries(productSales)
        .sort(([, a], [, b]) => b.rev - a.rev)
        .slice(0, 4)
        .map(([id]) => id);

      let nameMap: Record<string, string> = {};
      if (topIds.length > 0) {
        const { data: pData } = await supabase
          .from("products")
          .select("id, name")
          .in("id", topIds);
        for (const p of pData || []) nameMap[p.id] = p.name;
      }

      setBestSelling(
        topIds.map((id) => ({
          name: nameMap[id] || "Unknown",
          quantity: productSales[id].qty,
          revenue: productSales[id].rev,
        }))
      );

      // Recent transactions with product names
      const { data: recent } = await supabase
        .from("sales")
        .select("id, total, payment_method, created_at, sale_items(product_id, quantity)")
        .order("created_at", { ascending: false })
        .limit(4);

      const recentData = (recent || []) as SaleSimpleRow[];

      // Resolve product names for recent transaction items
      const allProductIds = new Set<string>();
      for (const s of recentData) {
        for (const i of s.sale_items || []) allProductIds.add(i.product_id);
      }

      let pnMap: Record<string, string> = {};
      if (allProductIds.size > 0) {
        const { data: pnData } = await supabase
          .from("products")
          .select("id, name")
          .in("id", [...allProductIds]);
        for (const p of (pnData || []) as ProductRow[]) pnMap[p.id] = p.name;
      }

      setRecentTransactions(
        recentData.map((s) => ({
          id: s.id,
          items: (s.sale_items || []).slice(0, 2).map((i) => pnMap[i.product_id] || i.product_id).join(", ") + ((s.sale_items || []).length > 2 ? " +more" : ""),
          total: Number(s.total),
          created_at: s.created_at,
          payment_method: s.payment_method,
        }))
      );
    } catch {
      // Silently fail - will show zeros/empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const formatTimeAgo = useCallback((dateStr: string) => timeAgo(dateStr), []);

  return {
    stats, recentTransactions, lowStockItems, bestSelling,
    loading, refetch: fetchDashboard, formatTimeAgo,
  };
}
