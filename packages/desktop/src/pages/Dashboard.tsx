import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, ShoppingCart, Package, AlertTriangle, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@pos/shared/components/card';
import { formatCurrency } from '@pos/shared/lib/utils';
import { Badge } from '@pos/shared/components/badge';
import { useNavigate } from 'react-router-dom';
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

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0, todayProfit: 0, totalProducts: 0, lowStockCount: 0, salesTrend: 0, profitTrend: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [bestSelling, setBestSelling] = useState<BestSellingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchDashboard = useCallback(async () => {
    setError(null);
    try {
      const [todayData, reportData, products, lowStockRows, recentSales] = await Promise.all([
        api.sales.todayStats() as Promise<{ totalSales: number; profit: number; transactionCount: number }>,
        api.sales.report('daily') as Promise<{ topProducts: Array<{ name: string; quantity: number; revenue: number }> }>,
        api.products.list() as Promise<Array<{ id: string; name: string; stock: number }>>,
        api.inventory.lowStock() as Promise<Array<{ id: string; name: string; stock: number }>>,
        api.sales.list({ limit: 4 }) as Promise<Array<{ id: string; total: number; payment_method: string; created_at: string; item_names: string }>>,
      ]);

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

      setStats({
        todaySales: todayData.totalSales,
        todayProfit: todayData.profit,
        totalProducts: products.length,
        lowStockCount: lowStockRows.length,
        salesTrend: calcTrend(todayData.totalSales, yesterdayData.periodData.sales),
        profitTrend: calcTrend(todayData.profit, yesterdayData.periodData.profit),
      });

      setLowStockItems(lowStockRows.slice(0, 4).map((p) => ({ id: p.id, name: p.name, stock: p.stock })));
      setBestSelling((reportData.topProducts || []).slice(0, 4));

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

  const statCards = [
    {
      title: "Today's Sales", value: formatCurrency(stats.todaySales),
      change: `${stats.salesTrend >= 0 ? '+' : ''}${stats.salesTrend}%`,
      trendUp: stats.salesTrend >= 0, icon: ShoppingCart,
    },
    {
      title: "Today's Profit", value: formatCurrency(stats.todayProfit),
      change: `${stats.profitTrend >= 0 ? '+' : ''}${stats.profitTrend}%`,
      trendUp: stats.profitTrend >= 0, icon: TrendingUp,
    },
    {
      title: 'Products', value: String(stats.totalProducts),
      change: `${stats.totalProducts} total`, trendUp: true, icon: Package,
    },
    {
      title: 'Low Stock Items', value: String(stats.lowStockCount),
      change: 'need restock', trendUp: false, icon: AlertTriangle,
    },
  ];

  const methodLabel: Record<string, string> = {
    cash: 'Cash',
    momo: 'MoMo',
    card: 'Card',
  };

  return (
    <div className="p-6">
      {error && <p className="text-red-500 mb-4">{error}</p>}

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your shop overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : stat.value}</div>
              <p className="text-xs text-muted-foreground">
                <span className={stat.trendUp ? 'text-green-600' : 'text-red-600'}>{stat.change}</span>{' '}
                from yesterday
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Recent Transactions</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : recentTransactions.length === 0 ? (
              <p className="text-muted-foreground">No transactions today</p>
            ) : (
              <div className="space-y-4">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">{tx.items}</p>
                      <p className="text-sm text-muted-foreground">{timeAgo(tx.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(tx.total)}</p>
                      <Badge variant="outline">{methodLabel[tx.payment_method] || tx.payment_method}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : lowStockItems.length === 0 ? (
              <p className="text-muted-foreground">All products are well stocked</p>
            ) : (
              <div className="space-y-4">
                {lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <p className="font-medium">{item.name}</p>
                    <Badge variant={item.stock === 0 ? 'destructive' : 'secondary'}>
                      {item.stock === 0 ? 'Out of stock' : `${item.stock} left`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Best Selling Products</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : bestSelling.length === 0 ? (
              <p className="text-muted-foreground">No sales data yet</p>
            ) : (
              <div className="space-y-4">
                {bestSelling.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.quantity} sold</p>
                      </div>
                    </div>
                    <p className="font-bold">{formatCurrency(item.revenue)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => navigate('/sales')} className="p-4 border rounded-lg hover:bg-accent transition-colors text-center cursor-pointer">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-primary" />
                <span className="font-medium">New Sale</span>
              </button>
              <button onClick={() => navigate('/products')} className="p-4 border rounded-lg hover:bg-accent transition-colors text-center cursor-pointer">
                <Package className="h-8 w-8 mx-auto mb-2 text-primary" />
                <span className="font-medium">Add Product</span>
              </button>
              <button onClick={() => navigate('/inventory')} className="p-4 border rounded-lg hover:bg-accent transition-colors text-center cursor-pointer">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-primary" />
                <span className="font-medium">Stock In</span>
              </button>
              <button onClick={() => navigate('/reports')} className="p-4 border rounded-lg hover:bg-accent transition-colors text-center cursor-pointer">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 text-primary" />
                <span className="font-medium">View Reports</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
