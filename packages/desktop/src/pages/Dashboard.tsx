import {
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { Badge } from '@pos/shared/components/badge';
import { formatCurrency } from '@pos/shared/lib/utils';
import { useDashboard } from '../hooks/useDashboard';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { stats, recentTransactions, lowStockItems, bestSelling, loading, formatTimeAgo } = useDashboard();
  const navigate = useNavigate();

  return (
    <div className="p-8 h-full overflow-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your shop overview.</p>
        </div>
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
          <TrendingUp className="h-6 w-6 text-primary" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ShoppingCart className="h-16 w-16" />
          </div>
          <div className="flex flex-row items-center justify-between space-y-0 pb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Today's Sales</h3>
            <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
              <ShoppingCart className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">{loading ? '...' : formatCurrency(stats.todaySales)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              {stats.salesTrend >= 0 ? '+' : ''}{stats.salesTrend}% from yesterday
            </p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp className="h-16 w-16" />
          </div>
          <div className="flex flex-row items-center justify-between space-y-0 pb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Today's Profit</h3>
            <div className="p-2 bg-success/10 rounded-lg border border-success/20">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">{loading ? '...' : formatCurrency(stats.todayProfit)}</div>
            <p className="text-xs text-success flex items-center gap-1">
              {stats.profitTrend >= 0 ? '+' : ''}{stats.profitTrend}% from yesterday
            </p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Package className="h-16 w-16" />
          </div>
          <div className="flex flex-row items-center justify-between space-y-0 pb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Products</h3>
            <div className="p-2 bg-info/10 rounded-lg border border-info/20">
              <Package className="h-4 w-4 text-info" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">{loading ? '...' : stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">Total products</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle className="h-16 w-16" />
          </div>
          <div className="flex flex-row items-center justify-between space-y-0 pb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Low Stock</h3>
            <div className="p-2 bg-warning/10 rounded-lg border border-warning/20">
              <AlertTriangle className="h-4 w-4 text-warning" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-warning mb-1">{loading ? '...' : stats.lowStockCount}</div>
            <p className="text-xs text-muted-foreground">Items need restocking</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Transactions */}
        <div className="glass-card rounded-2xl flex flex-col">
          <div className="p-6 border-b border-white/5">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Recent Transactions
            </h3>
          </div>
          <div className="p-6 flex-1">
            <div className="space-y-4">
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : recentTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground opacity-50">
                  <ShoppingCart className="h-12 w-12 mb-2" />
                  <p>No transactions yet</p>
                </div>
              ) : (
                recentTransactions.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium border border-primary/20">
                        {sale.items.charAt(0).toUpperCase() || 'S'}
                      </div>
                      <div>
                        <p className="font-medium text-white">{sale.items}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimeAgo(sale.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-white mb-1">{formatCurrency(sale.total)}</p>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-white/5 border-white/10">{sale.payment_method}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Best Selling Products */}
          <div className="glass-card rounded-2xl flex flex-col">
            <div className="p-6 border-b border-white/5">
              <h3 className="text-lg font-semibold text-white">Best Selling Products</h3>
            </div>
            <div className="p-6">
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : bestSelling.length === 0 ? (
                <p className="text-muted-foreground">No sales data yet</p>
              ) : (
                <div className="space-y-3">
                  {bestSelling.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                        <div>
                          <p className="font-medium text-white">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.quantity} sold</p>
                        </div>
                      </div>
                      <p className="font-bold text-white">{formatCurrency(item.revenue)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Low Stock Alert */}
          <div className="glass-card rounded-2xl flex flex-col">
            <div className="p-6 border-b border-warning/10 bg-warning/5 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Low Stock Alerts
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {loading ? (
                  <p className="text-muted-foreground text-center py-4">Loading...</p>
                ) : lowStockItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">All stock levels are good!</p>
                ) : (
                  lowStockItems.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5"
                    >
                      <div>
                        <p className="font-medium text-white">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.stock === 0 ? 'Out of stock' : 'Needs restocking'}
                        </p>
                      </div>
                      <Badge variant={item.stock === 0 ? 'destructive' : 'warning'} className="shadow-lg">
                        {item.stock === 0 ? 'Out of stock' : `${item.stock} left`}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-card rounded-2xl flex flex-col relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-600/5 pointer-events-none"></div>
            <div className="p-6 border-b border-white/5 relative z-10">
              <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
            </div>
            <div className="p-6 relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <button
                  className="flex flex-col items-center justify-center p-6 rounded-xl bg-black/20 border border-white/10 hover:border-primary/50 hover:bg-primary/10 transition-all duration-300 group shadow-lg cursor-pointer"
                  onClick={() => navigate('/sales')}
                >
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                    <ShoppingCart className="h-6 w-6 text-primary" />
                  </div>
                  <span className="font-semibold text-white mb-1">New Sale</span>
                  <span className="text-[10px] text-muted-foreground text-center uppercase tracking-wider">Start transaction</span>
                </button>
                <button
                  className="flex flex-col items-center justify-center p-6 rounded-xl bg-black/20 border border-white/10 hover:border-info/50 hover:bg-info/10 transition-all duration-300 group shadow-lg cursor-pointer"
                  onClick={() => navigate('/products')}
                >
                  <div className="w-12 h-12 rounded-full bg-info/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    <Package className="h-6 w-6 text-info" />
                  </div>
                  <span className="font-semibold text-white mb-1">Add Product</span>
                  <span className="text-[10px] text-muted-foreground text-center uppercase tracking-wider">Inventory</span>
                </button>
                <button
                  className="flex flex-col items-center justify-center p-6 rounded-xl bg-black/20 border border-white/10 hover:border-success/50 hover:bg-success/10 transition-all duration-300 group shadow-lg cursor-pointer"
                  onClick={() => navigate('/inventory')}
                >
                  <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <TrendingUp className="h-6 w-6 text-success" />
                  </div>
                  <span className="font-semibold text-white mb-1">Stock In</span>
                  <span className="text-[10px] text-muted-foreground text-center uppercase tracking-wider">Receive</span>
                </button>
                <button
                  className="flex flex-col items-center justify-center p-6 rounded-xl bg-black/20 border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all duration-300 group shadow-lg cursor-pointer"
                  onClick={() => navigate('/reports')}
                >
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                    <BarChart3 className="h-6 w-6 text-purple-400" />
                  </div>
                  <span className="font-semibold text-white mb-1">Reports</span>
                  <span className="text-[10px] text-muted-foreground text-center uppercase tracking-wider">Analytics</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
