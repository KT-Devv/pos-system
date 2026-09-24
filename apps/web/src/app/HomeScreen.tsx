"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
  formatCurrency,
  Logo,
  PageHeader,
  roundCurrency,
  StatCard,
} from "@pos/shared";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Monitor,
  Package,
  PackageX,
  Receipt,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme";
import { paymentLabel, StockBadge } from "@/features/common";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";

type RecentSale = { id: string; total: number; payment_method: string; created_at: string };
type StockRow = { id: string; name: string; stock: number };

export default function HomeScreen() {
  // Signed-out visitors see the public page; signed-in people land on their shop's overview.
  return (
    <WorkspaceGate signedOut={<Welcome />}>
      <Dashboard />
    </WorkspaceGate>
  );
}

/* ------------------------------------------------------------------ */
/* Signed-in overview                                                  */
/* ------------------------------------------------------------------ */

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const quickLinks = [
  { title: "Products", description: "Prices, barcodes, categories", href: "/products", Icon: Package },
  { title: "Inventory", description: "Record stock movements", href: "/inventory", Icon: Truck },
  { title: "Customers", description: "Loyalty balances", href: "/customers", Icon: Users },
  { title: "Reports", description: "Revenue and profit", href: "/reports", Icon: BarChart3 },
] as const;

function Dashboard() {
  const { supabase, user, shop, role, signOut } = useWorkspace();
  const lowAt = shop.low_stock_threshold;
  const [today, setToday] = useState({ count: 0, revenue: 0 });
  const [lowStock, setLowStock] = useState<StockRow[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [recent, setRecent] = useState<RecentSale[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    Promise.all([
      supabase.from("sales").select("total").gte("created_at", start.toISOString()),
      // Filter and count on the server: fetching whole tables is silently capped at 1000 rows.
      supabase.from("products").select("id,name,stock", { count: "exact" }).lt("stock", lowAt).order("stock", { ascending: true }).limit(50),
      supabase.from("customers").select("id", { count: "exact", head: true }),
      supabase
        .from("sales")
        .select("id,total,payment_method,created_at")
        .order("created_at", { ascending: false })
        .limit(6),
    ])
      .then(([todayRes, productsRes, customersRes, recentRes]) => {
        if (!active) return;
        if (todayRes.error) setError(todayRes.error.message);
        else {
          const rows = (todayRes.data ?? []) as { total: number }[];
          setToday({
            count: rows.length,
            revenue: roundCurrency(rows.reduce((sum, sale) => sum + Number(sale.total), 0)),
          });
        }
        if (productsRes.error) setError(productsRes.error.message);
        else {
          const rows = (productsRes.data ?? []) as StockRow[];
          setLowStock(rows);
          setLowStockCount(productsRes.count ?? rows.length);
        }
        if (customersRes.error) setError(customersRes.error.message);
        else setCustomerCount(customersRes.count ?? 0);
        if (recentRes.error) setError(recentRes.error.message);
        else setRecent((recentRes.data ?? []) as RecentSale[]);
        setLoaded(true);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      active = false;
    };
  }, [supabase, lowAt]);

  const firstName = user.name.trim().split(" ")[0] || "there";

  return (
    <AppShell section="home" user={{ id: user.id, name: user.name, role }} shopName={shop.name} onSignOut={() => void signOut()}>
      <div className="grid gap-6">
        <PageHeader
          eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          title={`${greeting()}, ${firstName}`}
          description={`Here's how ${shop.name} is doing today.`}
          actions={
            <Button asChild size="lg">
              <Link href="/sales">
                <ShoppingCart />
                Start a sale
              </Link>
            </Button>
          }
        />

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard hero className="sm:col-span-2" label="Today's revenue" icon={CircleDollarSign} value={formatCurrency(today.revenue)} hint="Since midnight" />
          <StatCard label="Sales today" icon={Receipt} value={today.count.toLocaleString()} hint={today.count ? `Average ${formatCurrency(today.revenue / today.count)}` : "No sales yet today"} />
          <StatCard
            label="Low stock"
            icon={lowStockCount > 0 ? PackageX : CheckCircle2}
            tone={lowStockCount > 0 ? "warning" : "success"}
            value={lowStockCount.toLocaleString()}
            hint={lowStockCount > 0 ? "Items to restock soon" : loaded ? "Everything is stocked" : "Checking stock…"}
          />
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Recent sales</CardTitle>
                <CardDescription>The latest transactions across the shop.</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/reports">
                  Reports
                  <ArrowRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              {recent.length > 0 ? (
                <ul className="divide-y border-t">
                  {recent.map((sale) => (
                    <li key={sale.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                        <Receipt className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          {new Date(sale.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      </div>
                      <Badge variant="secondary">{paymentLabel(sale.payment_method)}</Badge>
                      <p className="w-28 text-right text-sm font-bold tabular-nums">{formatCurrency(sale.total)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={Receipt}
                  title={loaded ? "No sales yet" : "Loading sales…"}
                  description={loaded ? "Start your first sale and it will appear here." : undefined}
                  action={loaded ? <Button asChild><Link href="/sales"><ShoppingCart />Start a sale</Link></Button> : undefined}
                />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Restock soon</CardTitle>
                <CardDescription>Products running low or out.</CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-2">
                {lowStock.length > 0 ? (
                  <ul className="divide-y border-t">
                    {lowStock.slice(0, 5).map((product) => (
                      <li key={product.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                        <p className="min-w-0 truncate text-sm font-semibold">{product.name}</p>
                        <StockBadge stock={product.stock} threshold={lowAt} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="border-t px-5 py-4 text-sm text-muted-foreground">
                    {loaded ? "Nothing needs restocking right now." : "Checking stock…"}
                  </p>
                )}
                {lowStockCount > 5 && (
                  <p className="px-5 pt-2 text-xs text-muted-foreground">+{lowStockCount - 5} more in Inventory</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Jump to</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1 px-3 pb-3">
                {quickLinks.map(({ title, description, href, Icon }) => (
                  <Link key={href} href={href} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-accent">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {href === "/customers" ? `${customerCount} registered` : description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* Public landing                                                      */
/* ------------------------------------------------------------------ */

const features = [
  { title: "Fast checkout", text: "A touch-friendly terminal with barcode scanning, live totals, and change calculation.", icon: ShoppingCart },
  { title: "Products & pricing", text: "Manage prices, categories, and barcodes with margins visible at a glance.", icon: Package },
  { title: "Inventory you trust", text: "Every sale and delivery updates stock automatically, with low-stock alerts.", icon: Truck },
  { title: "Customers & loyalty", text: "Keep contact details and reward repeat shoppers with points.", icon: Users },
  { title: "Reports that matter", text: "Revenue, profit, payment mix, and top sellers over any period.", icon: BarChart3 },
  { title: "Works offline", text: "The desktop app queues sales without a connection and syncs when it returns.", icon: Monitor },
];

/** Static, non-interactive miniature of the sales terminal for the hero. */
function TerminalPreview() {
  const tiles: [string, string, string][] = [
    ["Bottled water", "4.00", "24 left"],
    ["Fresh bread", "12.50", "8 left"],
    ["Shea butter", "35.00", "14 left"],
    ["Rice 5kg", "78.00", "6 left"],
    ["Tomato paste", "6.50", "31 left"],
    ["Sugar 1kg", "15.00", "3 left"],
  ];
  return (
    <div aria-hidden="true" className="rounded-2xl border bg-card p-3 shadow-lg">
      <div className="flex items-center gap-1.5 px-2 pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="ml-3 text-xs font-semibold text-muted-foreground">Sales</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
        <div className="grid gap-3">
          <div className="h-9 rounded-lg border bg-muted/60 px-3 text-xs leading-9 text-muted-foreground">Search products, or scan a barcode…</div>
          <div className="grid grid-cols-2 gap-2.5">
            {tiles.map(([name, price, left], index) => (
              <div key={name} className={cn("relative flex h-[86px] flex-col justify-between rounded-xl border p-2.5", index === 1 && "border-primary ring-1 ring-primary")}>
                {index === 1 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">1</span>}
                <p className="text-xs font-semibold leading-snug">{name}</p>
                <div className="flex items-end justify-between">
                  <span className="whitespace-nowrap text-[13px] font-extrabold">{price}</span>
                  <span className={cn("whitespace-nowrap text-[10px] font-semibold", left === "3 left" ? "text-warning" : "text-muted-foreground")}>{left}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid content-between gap-3 rounded-xl border bg-muted/40 p-3">
          <div>
            <p className="text-xs font-bold">Current sale</p>
            <ul className="mt-2.5 grid gap-2 text-xs">
              <li className="flex justify-between"><span>Bottled water ×2</span><span className="font-bold tabular-nums">8.00</span></li>
              <li className="flex justify-between"><span>Fresh bread</span><span className="font-bold tabular-nums">12.50</span></li>
              <li className="flex justify-between"><span>Shea butter</span><span className="font-bold tabular-nums">35.00</span></li>
            </ul>
          </div>
          <div className="grid gap-2 border-t pt-3">
            <div className="flex items-baseline justify-between"><span className="text-[11px] font-semibold">Total</span><span className="text-base font-extrabold tabular-nums">55.50</span></div>
            <div className="rounded-lg bg-primary py-2 text-center text-xs font-bold text-primary-foreground">Charge 55.50</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Welcome() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" aria-label="KT POS System home">
          <Logo wordmark size={36} />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/login?tab=signup">Create account</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pb-24 lg:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Built for everyday retail
            </p>
            <h1 className="mt-5 text-[40px] font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[56px]">
              Run your shop from one calm screen.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              KT POS System brings checkout, stock, customers, and reporting together, so the counter stays fast
              and the numbers stay honest.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="xl">
                <Link href="/login">
                  Sign in to your workspace
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline">
                <Link href="/login?tab=signup">Create an account</Link>
              </Button>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">Works with any currency · Cash, mobile money and card · Set up in minutes</p>
          </div>
          <TerminalPreview />
        </section>

        <section className="border-y bg-card">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
            <h2 className="max-w-xl text-3xl font-extrabold tracking-tight">Everything the counter needs, nothing it doesn&apos;t.</h2>
            <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ title, text, icon: Icon }) => (
                <div key={title} className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-bold">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
          <div
            className="flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-sidebar p-8 text-white sm:p-12"
            style={{ backgroundImage: "radial-gradient(ellipse 50% 90% at 100% 0%, rgba(63,192,141,0.25), transparent 70%)" }}
          >
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Ready to run the counter?</h2>
              <p className="mt-2 max-w-md text-sidebar-foreground">Sign in or create an account to open your workspace.</p>
            </div>
            <Button asChild size="xl" className="bg-[#3fc08d] text-[#052418] hover:bg-[#3fc08d]/90">
              <Link href="/login">Get started</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-6 text-sm text-muted-foreground sm:px-8">
          <span>© {new Date().getFullYear()} KT POS System</span>
          <span>Made for shops everywhere</span>
        </div>
      </footer>
    </div>
  );
}
