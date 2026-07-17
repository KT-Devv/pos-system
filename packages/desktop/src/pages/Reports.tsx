import { useState } from 'react';
import { Download, TrendingUp, DollarSign, ShoppingCart, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@pos/shared/components/card';
import { Button } from '@pos/shared/components/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pos/shared/components/select';
import { formatCurrency } from '@pos/shared/lib/utils';
import { Badge } from '@pos/shared/components/badge';
import { useReports, type ReportPeriod } from '@/hooks/useReports';

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Reports() {
  const [period, setPeriod] = useState<ReportPeriod>('daily');
  const [startDate, setStartDate] = useState(formatDateInput(new Date()));
  const [endDate, setEndDate] = useState(formatDateInput(new Date()));
  const { periodData, topProducts, dailySales, paymentMethods, loading, error } = useReports(period, startDate, endDate);

  const handleExport = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Sales', periodData.sales],
      ['Total Profit', periodData.profit],
      ['Transactions', periodData.transactions],
      ['Average Sale', periodData.averageSale],
      ...topProducts.map((p) => [`Top: ${p.name}`, p.revenue]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">View your business analytics</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          {period === 'custom' && (
            <div className="flex gap-2">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          )}
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-2" />Export</Button>
        </div>
      </div>

      {period === 'custom' && <p className="text-sm text-muted-foreground mb-4">Showing sales from {startDate} to {endDate}</p>}
      {error && <p className="text-red-500 mb-4">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">Loading reports...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Sales</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(periodData.sales)}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Profit</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(periodData.profit)}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Transactions</CardTitle><ShoppingCart className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{periodData.transactions}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Average Sale</CardTitle><Package className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(periodData.averageSale)}</div></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Top Selling Products</CardTitle></CardHeader>
              <CardContent>
                {topProducts.length === 0 ? <p className="text-muted-foreground">No sales data for this period</p> : (
                  <div className="space-y-4">
                    {topProducts.map((product, index) => (
                      <div key={product.name} className="flex items-center justify-between border-b pb-3 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-muted-foreground w-6">#{index + 1}</span>
                          <div><p className="font-medium">{product.name}</p><p className="text-sm text-muted-foreground">{product.quantity} sold</p></div>
                        </div>
                        <div className="text-right"><p className="font-bold">{formatCurrency(product.revenue)}</p><p className="text-sm text-green-600">+{formatCurrency(product.profit)} profit</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Recent Sales</CardTitle></CardHeader>
              <CardContent>
                {dailySales.length === 0 ? <p className="text-muted-foreground">No recent sales</p> : (
                  <div className="space-y-4">
                    {dailySales.map((sale) => (
                      <div key={sale.date} className="flex items-center justify-between border-b pb-3 last:border-0">
                        <div><p className="font-medium">{sale.date}</p><p className="text-sm text-muted-foreground">{sale.transactions} transactions</p></div>
                        <div className="text-right"><p className="font-bold">{formatCurrency(sale.total)}</p><p className="text-sm text-green-600">{formatCurrency(sale.profit)} profit</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Payment Methods</CardTitle></CardHeader>
              <CardContent>
                {paymentMethods.length === 0 ? <p className="text-muted-foreground">No payment data</p> : (
                  <div className="space-y-4">
                    {paymentMethods.map((pm) => (
                      <div key={pm.method} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${pm.method === 'Cash' ? 'bg-green-500' : pm.method === 'Mobile Money' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                          <span>{pm.method}</span>
                        </div>
                        <div className="flex items-center gap-2"><span className="font-bold">{formatCurrency(pm.amount)}</span><Badge variant="secondary">{pm.percentage}%</Badge></div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Profit Trend</CardTitle></CardHeader>
              <CardContent>
                {dailySales.length === 0 ? <p className="text-muted-foreground">No data available</p> : (
                  <div className="space-y-4">
                    {dailySales.map((sale) => {
                      const maxProfit = Math.max(...dailySales.map((s) => s.profit), 1);
                      return (
                        <div key={sale.date} className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground w-20">{sale.date.split('-').slice(1).join('-')}</span>
                          <div className="flex-1"><div className="h-4 bg-muted rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${Math.max(0, (sale.profit / maxProfit) * 100)}%` }} /></div></div>
                          <span className="font-bold w-20 text-right">{formatCurrency(sale.profit)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
