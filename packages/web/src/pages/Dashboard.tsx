import {
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@pos/shared/components/card";
import { formatCurrency } from "@pos/shared/lib/utils";
import { Badge } from "@pos/shared/components/badge";
import { useDashboard } from "../hooks/useDashboard";

const methodLabel: Record<string, string> = {
  cash: "Cash",
  momo: "MoMo",
  card: "Card",
};

export default function Dashboard() {
  const {
    stats, recentTransactions, lowStockItems, bestSelling,
    loading, formatTimeAgo,
  } = useDashboard();

  const salesTrendUp = stats.salesTrend >= 0;
  const profitTrendUp = stats.profitTrend >= 0;

  const statCards = [
    {
      title: "Today's Sales",
      value: formatCurrency(stats.todaySales),
      change: `${stats.salesTrend >= 0 ? "+" : ""}${stats.salesTrend}%`,
      trendUp: salesTrendUp,
      icon: ShoppingCart,
    },
    {
      title: "Today's Profit",
      value: formatCurrency(stats.todayProfit),
      change: `${stats.profitTrend >= 0 ? "+" : ""}${stats.profitTrend}%`,
      trendUp: profitTrendUp,
      icon: TrendingUp,
    },
    {
      title: "Products",
      value: String(stats.totalProducts),
      change: `${stats.totalProducts} total`,
      trendUp: true,
      icon: Package,
    },
    {
      title: "Low Stock Items",
      value: String(stats.lowStockCount),
      change: "need restock",
      trendUp: false,
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="p-6">
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
              <div className="text-2xl font-bold">{loading ? "..." : stat.value}</div>
              <p className="text-xs text-muted-foreground">
                  <span
                    className={
                      stat.trendUp ? "text-green-600" : "text-red-600"
                    }
                  >
                  {stat.change}
                </span>{" "}
                from yesterday
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : recentTransactions.length === 0 ? (
              <p className="text-muted-foreground">No transactions today</p>
            ) : (
              <div className="space-y-4">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{tx.items}</p>
                      <p className="text-sm text-muted-foreground">{formatTimeAgo(tx.created_at)}</p>
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
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Low Stock Alerts
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
                  <div
                    key={item.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                    </div>
                    <Badge variant={item.stock === 0 ? "destructive" : "warning"}>
                      {item.stock === 0 ? "Out of stock" : `${item.stock} left`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Best Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : bestSelling.length === 0 ? (
              <p className="text-muted-foreground">No sales data yet</p>
            ) : (
              <div className="space-y-4">
                {bestSelling.map((item, index) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between border-b pb-2 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} sold
                        </p>
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
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <button className="p-4 border rounded-lg hover:bg-accent transition-colors text-center">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-primary" />
                <span className="font-medium">New Sale</span>
              </button>
              <button className="p-4 border rounded-lg hover:bg-accent transition-colors text-center">
                <Package className="h-8 w-8 mx-auto mb-2 text-primary" />
                <span className="font-medium">Add Product</span>
              </button>
              <button className="p-4 border rounded-lg hover:bg-accent transition-colors text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-primary" />
                <span className="font-medium">Stock In</span>
              </button>
              <button className="p-4 border rounded-lg hover:bg-accent transition-colors text-center">
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
