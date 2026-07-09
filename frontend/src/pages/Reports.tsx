import { useState } from "react";
import { Download, TrendingUp, DollarSign, ShoppingCart, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const reportData = {
  daily: {
    sales: 2450,
    profit: 890,
    transactions: 28,
    averageSale: 87.5,
  },
  weekly: {
    sales: 15800,
    profit: 5650,
    transactions: 185,
    averageSale: 85.4,
  },
  monthly: {
    sales: 62000,
    profit: 22300,
    transactions: 720,
    averageSale: 86.1,
  },
};

const topProducts = [
  { name: "Milk", quantity: 45, revenue: 1125, profit: 225 },
  { name: "Bread", quantity: 38, revenue: 684, profit: 228 },
  { name: "Rice (5kg)", quantity: 22, revenue: 3300, profit: 660 },
  { name: "Water (500ml)", quantity: 60, revenue: 300, profit: 180 },
  { name: "Cooking Oil", quantity: 15, revenue: 675, profit: 150 },
];

const recentSales = [
  { date: "2024-01-15", total: 2450, profit: 890, transactions: 28 },
  { date: "2024-01-14", total: 2180, profit: 785, transactions: 24 },
  { date: "2024-01-13", total: 1920, profit: 690, transactions: 22 },
  { date: "2024-01-12", total: 2650, profit: 955, transactions: 30 },
  { date: "2024-01-11", total: 2350, profit: 845, transactions: 26 },
];

export default function Reports() {
  const [period, setPeriod] = useState("daily");
  const data = reportData[period as keyof typeof reportData];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">View your business analytics</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.sales)}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+12%</span> from last period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.profit)}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+8%</span> from last period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.transactions}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+5%</span> from last period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Sale</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.averageSale)}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600">-2%</span> from last period
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProducts.map((product, index) => (
                <div
                  key={product.name}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-6">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {product.quantity} sold
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(product.revenue)}</p>
                    <p className="text-sm text-green-600">
                      +{formatCurrency(product.profit)} profit
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sales History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSales.map((sale) => (
                <div
                  key={sale.date}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div>
                    <p className="font-medium">{sale.date}</p>
                    <p className="text-sm text-muted-foreground">
                      {sale.transactions} transactions
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(sale.total)}</p>
                    <p className="text-sm text-green-600">
                      {formatCurrency(sale.profit)} profit
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Cash</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{formatCurrency(1200)}</span>
                  <Badge variant="secondary">49%</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span>Mobile Money</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{formatCurrency(950)}</span>
                  <Badge variant="secondary">39%</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>Card</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{formatCurrency(300)}</span>
                  <Badge variant="secondary">12%</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profit Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Profit Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSales.map((sale) => (
                <div key={sale.date} className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-20">
                    {sale.date.split("-").slice(1).join("-")}
                  </span>
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${(sale.profit / 1000) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-bold w-20 text-right">
                    {formatCurrency(sale.profit)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
