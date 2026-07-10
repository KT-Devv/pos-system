import {
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@pos/shared/components/card';
import { Badge } from '@pos/shared/components/badge';
import { Button } from '@pos/shared/components/button';
import { formatCurrency } from '@pos/shared/lib/utils';
import { useTodayStats } from '../hooks/useSales';
import { useProducts } from '../hooks/useProducts';
import { useLowStock } from '../hooks/useInventory';
import { useEffect, useState } from 'react';
import { api } from '../lib/ipc';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { stats } = useTodayStats();
  const { products } = useProducts();
  const { items: lowStock } = useLowStock();
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.sales.list({ limit: 5 }).then(setRecentSales);
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your shop overview.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalSales)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.transactionCount} transactions today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.profit)}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">Gross profit</span> today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground">Total products</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{lowStock.length}</div>
            <p className="text-xs text-muted-foreground">Items need restocking</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSales.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No transactions yet</p>
              ) : (
                recentSales.map((sale: any) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{sale.cashier_name || 'Cashier'}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(sale.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(sale.total)}</p>
                      <Badge variant="outline">{sale.payment_method}</Badge>
                    </div>
                  </div>
                ))
              )}
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
              {lowStock.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">All stock levels are good!</p>
              ) : (
                lowStock.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.category_name || 'No category'}
                      </p>
                    </div>
                    <Badge variant={item.stock < 5 ? 'destructive' : 'warning'}>
                      {item.stock} left
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button
                variant="outline"
                className="flex-col h-auto py-6 gap-2 hover:border-primary/30 hover:shadow-sm"
                onClick={() => navigate('/sales')}
              >
                <ShoppingCart className="h-8 w-8 text-primary" />
                <span className="font-medium text-sm">New Sale</span>
                <span className="text-xs text-muted-foreground">Start a new transaction</span>
              </Button>
              <Button
                variant="outline"
                className="flex-col h-auto py-6 gap-2 hover:border-primary/30 hover:shadow-sm"
                onClick={() => navigate('/products')}
              >
                <Package className="h-8 w-8 text-primary" />
                <span className="font-medium text-sm">Add Product</span>
                <span className="text-xs text-muted-foreground">Add to inventory</span>
              </Button>
              <Button
                variant="outline"
                className="flex-col h-auto py-6 gap-2 hover:border-primary/30 hover:shadow-sm"
                onClick={() => navigate('/inventory')}
              >
                <TrendingUp className="h-8 w-8 text-primary" />
                <span className="font-medium text-sm">Stock In</span>
                <span className="text-xs text-muted-foreground">Receive stock</span>
              </Button>
              <Button
                variant="outline"
                className="flex-col h-auto py-6 gap-2 hover:border-primary/30 hover:shadow-sm"
                onClick={() => navigate('/reports')}
              >
                <BarChart3 className="h-8 w-8 text-primary" />
                <span className="font-medium text-sm">View Reports</span>
                <span className="text-xs text-muted-foreground">Analytics</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
