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

// Mock data for now
const stats = [
  {
    title: "Today's Sales",
    value: formatCurrency(2450),
    change: "+12%",
    trend: "up" as const,
    icon: ShoppingCart,
  },
  {
    title: "Today's Profit",
    value: formatCurrency(890),
    change: "+8%",
    trend: "up" as const,
    icon: TrendingUp,
  },
  {
    title: "Products",
    value: "156",
    change: "+3",
    trend: "up" as const,
    icon: Package,
  },
  {
    title: "Low Stock Items",
    value: "8",
    change: "+2",
    trend: "down" as const,
    icon: AlertTriangle,
  },
];

const recentTransactions = [
  { id: "1", items: "Milk, Bread", total: 43, time: "2 min ago", method: "Cash" },
  { id: "2", items: "Rice, Oil", total: 185, time: "15 min ago", method: "MoMo" },
  { id: "3", items: "Water, Snacks", total: 32, time: "32 min ago", method: "Card" },
  { id: "4", items: "Soap, Detergent", total: 67, time: "1 hr ago", method: "Cash" },
];

const lowStockItems = [
  { name: "Milk", stock: 3, threshold: 10 },
  { name: "Bread", stock: 5, threshold: 15 },
  { name: "Cooking Oil", stock: 2, threshold: 8 },
  { name: "Rice (5kg)", stock: 4, threshold: 10 },
];

const bestSelling = [
  { name: "Milk", sold: 45, revenue: 1125 },
  { name: "Bread", sold: 38, revenue: 684 },
  { name: "Rice", sold: 22, revenue: 3300 },
  { name: "Water", sold: 60, revenue: 300 },
];

export default function Dashboard() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your shop overview.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                <span
                  className={
                    stat.trend === "up" ? "text-green-600" : "text-red-600"
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
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <div>
                    <p className="font-medium">{tx.items}</p>
                    <p className="text-sm text-muted-foreground">{tx.time}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(tx.total)}</p>
                    <Badge variant="outline">{tx.method}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lowStockItems.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Threshold: {item.threshold}
                    </p>
                  </div>
                  <Badge variant={item.stock < 5 ? "destructive" : "warning"}>
                    {item.stock} left
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Best Selling Products */}
        <Card>
          <CardHeader>
            <CardTitle>Best Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
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
                        {item.sold} sold
                      </p>
                    </div>
                  </div>
                  <p className="font-bold">{formatCurrency(item.revenue)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
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
