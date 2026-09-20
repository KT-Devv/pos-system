"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  currencySymbol,
  EmptyState,
  formatCompact,
  formatCurrency,
  PageHeader,
  buildRevenueBuckets,
  rangeStart,
  summarizeSales,
  type ReportLine,
  type ReportRange,
  type ReportSale,
  SegmentedControl,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pos/shared";
import { BarChart3, CircleDollarSign, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { StackedBar, type TrendPoint, TrendChart } from "@/components/charts";
import { type Client, fail, fetchAll, PAYMENT_METHODS, type PaymentMethodValue, paymentLabel } from "./common";

const RANGES: { value: ReportRange; label: string; phrase: string }[] = [
  { value: "7", label: "7 days", phrase: "Last 7 days" },
  { value: "30", label: "30 days", phrase: "Last 30 days" },
  { value: "90", label: "90 days", phrase: "Last 90 days" },
  { value: "all", label: "All time", phrase: "All time" },
];

// Categorical slots are assigned by payment method, never by rank, so colors stay put when data changes.
const METHOD_COLOR: Record<PaymentMethodValue, string> = {
  cash: "var(--chart-1)",
  momo: "var(--chart-2)",
  card: "var(--chart-3)",
};

const shortDate = (date: Date) => date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
const longDate = (date: Date) => date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

/** Turn the tested bucket math into labelled chart points. */
function toTrend(sales: ReportSale[], start: Date): { points: TrendPoint[]; weekly: boolean } {
  const { buckets, weekly } = buildRevenueBuckets(sales, start);
  const points = buckets.map(bucket => ({
    key: bucket.date.toISOString(),
    label: shortDate(bucket.date),
    title: weekly ? `Week of ${shortDate(bucket.date)}` : longDate(bucket.date),
    value: bucket.value,
    detail: `${bucket.count} ${bucket.count === 1 ? "sale" : "sales"}`,
  }));
  return { points, weekly };
}

export function Reports({ supabase, onError }: { supabase: Client; onError: (message: string) => void }) {
  const [sales, setSales] = useState<ReportSale[]>([]);
  const [lines, setLines] = useState<ReportLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [range, setRange] = useState<ReportRange>("30");
  const [trendView, setTrendView] = useState<"chart" | "table">("chart");
  const [activeMethod, setActiveMethod] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const salesRes = await fetchAll<ReportSale>((from, to) =>
        supabase.from("sales").select("id,total,discount,payment_method,created_at").order("created_at", { ascending: false }).order("id").range(from, to));
      // Product names enrich "Top products"; fall back to the plain query if the embed is refused.
      let linesRes = await fetchAll<ReportLine>((from, to) =>
        supabase.from("sale_lines").select("sale_id,product_id,quantity,unit_price,unit_cost,products(name)").order("id").range(from, to));
      if (linesRes.error) {
        linesRes = await fetchAll<ReportLine>((from, to) =>
          supabase.from("sale_lines").select("sale_id,quantity,unit_price,unit_cost").order("id").range(from, to));
      }
      if (!active) return;
      if (salesRes.error) fail(onError, salesRes.error); else setSales(salesRes.data);
      if (linesRes.error) fail(onError, linesRes.error); else setLines(linesRes.data);
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [supabase, onError]);

  const rangeInfo = RANGES.find(r => r.value === range)!;

  const view = useMemo(() => {
    const start = rangeStart(range, sales);
    const summary = summarizeSales(sales, lines, start, Object.keys(PAYMENT_METHODS));
    const payments = summary.payments.map(payment => ({
      key: payment.method,
      label: PAYMENT_METHODS[payment.method as PaymentMethodValue].label,
      value: payment.value,
      count: payment.count,
      color: METHOD_COLOR[payment.method as PaymentMethodValue],
    }));
    return { ...summary, inRange: summary.sales, payments, ...toTrend(summary.sales, start) };
  }, [sales, lines, range]);

  const { inRange, revenue, profit, marginPct, payments, topProducts, points: trend, weekly } = view;
  const avgSale = inRange.length ? revenue / inRange.length : 0;
  const hasSales = inRange.length > 0;
  const topMax = topProducts[0]?.revenue ?? 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Reports"
        description="Revenue, profit, and how customers are paying."
        actions={
          <SegmentedControl aria-label="Report period" value={range} onValueChange={setRange} options={RANGES.map(({ value, label }) => ({ value, label }))} />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard hero className="sm:col-span-2" label="Revenue" icon={CircleDollarSign} value={formatCurrency(revenue)} hint={rangeInfo.phrase} />
        <StatCard
          label="Gross profit"
          icon={profit >= 0 ? TrendingUp : TrendingDown}
          tone={profit >= 0 ? "success" : "destructive"}
          value={formatCurrency(profit)}
          hint={hasSales ? `${marginPct}% margin` : "Revenue minus cost of goods"}
        />
        <StatCard label="Transactions" icon={Receipt} value={inRange.length.toLocaleString()} hint={hasSales ? `Average sale ${formatCurrency(avgSale)}` : "No sales in this period"} />
      </div>

      {!hasSales ? (
        <Card>
          <EmptyState
            icon={BarChart3}
            title={loaded ? "No sales in this period" : "Loading reports…"}
            description={loaded ? "Try a longer period, or complete a sale to see it here." : undefined}
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle>Revenue over time</CardTitle>
                <CardDescription>
                  {rangeInfo.phrase} · {weekly ? "weekly" : "daily"} totals
                </CardDescription>
              </div>
              <SegmentedControl
                aria-label="Chart or table view"
                value={trendView}
                onValueChange={setTrendView}
                options={[{ value: "chart", label: "Chart" }, { value: "table", label: "Table" }]}
              />
            </CardHeader>
            <CardContent>
              {trendView === "chart" ? (
                <TrendChart
                  data={trend}
                  formatValue={formatCurrency}
                  formatTick={(value) => `${currencySymbol()}${formatCompact(value)}`}
                  ariaLabel={`Revenue over time, ${rangeInfo.phrase.toLowerCase()}`}
                />
              ) : (
                <div className="max-h-[300px] overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0">
                      <TableRow>
                        <TableHead>{weekly ? "Week" : "Day"}</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...trend].reverse().map(point => (
                        <TableRow key={point.key}>
                          <TableCell>{point.title}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{point.detail?.split(" ")[0]}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(point.value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Payment mix</CardTitle>
                <CardDescription>Share of revenue by how customers paid.</CardDescription>
              </CardHeader>
              <CardContent>
                <StackedBar segments={payments} activeKey={activeMethod} onActiveChange={setActiveMethod}>
                  <ul className="mt-4 divide-y">
                    {payments.map(method => {
                      const share = revenue > 0 ? Math.round((method.value / revenue) * 100) : 0;
                      return (
                        <li
                          key={method.key}
                          onPointerEnter={() => setActiveMethod(method.key)}
                          onPointerLeave={() => setActiveMethod(null)}
                          className={cn("flex items-center gap-3 py-3", activeMethod === method.key && "bg-muted/60")}
                        >
                          <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: method.color }} aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{method.label}</p>
                            <p className="text-xs text-muted-foreground">{method.count} {method.count === 1 ? "sale" : "sales"}</p>
                          </div>
                          <p className="w-10 text-right text-sm text-muted-foreground tabular-nums">{share}%</p>
                          <p className="w-28 text-right text-sm font-bold tabular-nums">{formatCurrency(method.value)}</p>
                        </li>
                      );
                    })}
                  </ul>
                </StackedBar>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top products</CardTitle>
                <CardDescription>By sales value in this period.</CardDescription>
              </CardHeader>
              <CardContent>
                {topProducts.length > 0 ? (
                  <ol className="grid gap-4">
                    {topProducts.map((product, index) => (
                      <li key={product.name} className="grid gap-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="min-w-0 truncate text-sm font-semibold">
                            <span className="mr-2 text-muted-foreground tabular-nums">{index + 1}</span>
                            {product.name}
                          </p>
                          <p className="shrink-0 text-sm font-bold tabular-nums">{formatCurrency(product.revenue)}</p>
                        </div>
                        <div className="h-2 rounded-r-[4px] bg-muted">
                          <div className="h-full rounded-r-[4px] bg-primary" style={{ width: `${topMax > 0 ? (product.revenue / topMax) * 100 : 0}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground">{product.units} {product.units === 1 ? "unit" : "units"} sold</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">Product breakdown isn&apos;t available for this period.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent transactions</CardTitle>
              <CardDescription>Latest {Math.min(inRange.length, 30)} of {inRange.length} in this period.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date &amp; time</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Discount</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inRange.slice(0, 30).map(sale => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(sale.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </TableCell>
                      <TableCell><Badge variant="secondary">{paymentLabel(sale.payment_method)}</Badge></TableCell>
                      <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                        {Number(sale.discount) > 0 ? `−${formatCurrency(Number(sale.discount))}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">{formatCurrency(sale.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
