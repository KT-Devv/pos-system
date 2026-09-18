"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  formatCurrency,
  roundCurrency,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@pos/shared";
import {
  AlertCircle,
  BarChart3,
  CircleDollarSign,
  LogOut,
  Package,
  PackageX,
  Receipt,
  Settings as SettingsIcon,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";

type HomeUser = { id: string; name: string; role: string };
type RecentSale = { id: string; total: number; payment_method: string; created_at: string };

const features = [
  ["Sales", "Speed through checkout with a stock-safe cart and live totals.", ShoppingCart],
  ["Products", "Manage pricing, barcodes, categories, and stock in one place.", Package],
  ["Inventory", "Record stock movements and track the suppliers you buy from.", Truck],
  ["Customers", "Keep contact details and loyalty balances for repeat shoppers.", Users],
  ["Reports", "Review revenue, profit, margins, and payment trends.", BarChart3],
  ["Settings", "Personalise your profile, role, and shop preferences.", SettingsIcon],
] as const;

const quickLinks = [
  { title: "New sale", description: "Start a checkout and complete a sale.", href: "/sales", Icon: ShoppingCart },
  { title: "Catalog", description: "Add or edit products and categories.", href: "/products", Icon: Package },
  { title: "Stock levels", description: "Record movements and review stock.", href: "/inventory", Icon: Truck },
  { title: "Customers", description: "Manage customers and loyalty points.", href: "/customers", Icon: Users },
  { title: "Reports", description: "Review revenue and profit trends.", href: "/reports", Icon: BarChart3 },
  { title: "My settings", description: "Update your profile and password.", href: "/settings", Icon: SettingsIcon },
] as const;

export default function HomeScreen() {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<HomeUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!configured) {
      setChecked(true);
      return;
    }
    let active = true;
    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .getUser()
      .then(async ({ data: session, error: authError }) => {
        if (!active) return;
        if (!session.user || authError?.name === "AuthSessionMissingError") {
          setUser(null);
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("name,role")
          .eq("id", session.user.id)
          .maybeSingle();
        if (!active) return;
        setUser({
          id: session.user.id,
          name: profile?.name ?? session.user.email ?? "User",
          role: profile?.role ?? "cashier",
        });
      })
      .finally(() => {
        if (active) setChecked(true);
      });
    return () => {
      active = false;
    };
  }, [configured]);

  if (!checked) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-sm text-muted-foreground">
        Loading workspace...
      </main>
    );
  }

  return user ? <Dashboard user={user} /> : <Welcome />;
}

function Logo({ size = "md" }: { size?: "md" | "sm" }) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-lg bg-primary font-bold text-primary-foreground",
        size === "md" ? "h-9 w-9 text-sm" : "h-8 w-8 text-xs",
      )}
    >
      POS
    </div>
  );
}

function Welcome() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <Logo />
            <p className="text-lg font-bold tracking-tight">KTDEVV POS System</p>
          </div>
          <div className="hidden gap-2 sm:flex">
            <Button asChild variant="ghost">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/login?tab=signup">Create account</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16">
        <section className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Welcome
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Counter, stock, and customers — all in one place.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            KTDEVV POS System is a fast, reliable workspace for daily retail. Sign in to start
            recording sales, tracking inventory, building loyalty, and reviewing how the shop is doing.
          </p>
          <div className="mt-8 grid gap-3 sm:flex">
            <Button asChild size="lg">
              <Link href="/login">Sign in to your workspace</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login?tab=signup">Create an account</Link>
            </Button>
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, description, Icon]) => (
            <Card key={title} className="h-full">
              <CardHeader>
                <Icon className="mb-2 h-6 w-6 text-muted-foreground" />
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Ready to run the counter?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in or create an account to open the workspace.
            </p>
          </div>
          <Button asChild>
            <Link href="/login">Get started</Link>
          </Button>
        </div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6 text-sm text-muted-foreground">
          <span>Currency: {formatCurrency(0)}</span>
          <span>KTDEVV POS System</span>
        </div>
      </footer>
    </div>
  );
}

function Dashboard({ user }: { user: HomeUser }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [today, setToday] = useState({ count: 0, revenue: 0 });
  const [productCount, setProductCount] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [recent, setRecent] = useState<RecentSale[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    Promise.all([
      supabase.from("sales").select("total").gte("created_at", start.toISOString()),
      supabase.from("products").select("id,stock"),
      supabase.from("customers").select("id"),
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
          const rows = (productsRes.data ?? []) as { stock: number }[];
          setProductCount(rows.length);
          setLowStock(rows.filter((product) => product.stock < 5).length);
        }
        if (customersRes.error) setError(customersRes.error.message);
        else setCustomerCount((customersRes.data ?? []).length);
        if (recentRes.error) setError(recentRes.error.message);
        else setRecent((recentRes.data ?? []) as RecentSale[]);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      active = false;
    };
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const firstName = user.name.trim().split(" ")[0] || "there";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className="flex items-center gap-3">
            <Logo />
            <p className="text-lg font-bold tracking-tight">KTDEVV POS System</p>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden px-3 py-1 sm:inline-flex">
              {user.name}
            </Badge>
            <Badge className="hidden px-3 py-1 md:inline-flex">{user.role}</Badge>
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome back, {firstName}.</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Here&apos;s what&apos;s happening at {user.role === "admin" ? "the shop" : "work"} today.
            </p>
          </div>
          <Button asChild>
            <Link href="/sales">
              <ShoppingCart className="h-4 w-4" />
              Start a sale
            </Link>
          </Button>
        </section>

        {error && (
          <div className="mt-6 grid gap-2">
            <Card>
              <CardContent className="flex items-start gap-2 p-4 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </CardContent>
            </Card>
          </div>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Today's sales"
            value={String(today.count)}
            Icon={Receipt}
          />
          <StatCard
            label="Today's revenue"
            value={formatCurrency(today.revenue)}
            Icon={CircleDollarSign}
          />
          <StatCard
            label="Low-stock items"
            value={String(lowStock)}
            Icon={PackageX}
            tone={lowStock > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Registered customers"
            value={String(customerCount)}
            Icon={Users}
          />
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-tight">Quick actions</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quickLinks.map(({ title, description, href, Icon }) => (
              <Link
                key={href}
                href={href}
                className="block outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full hover:border-foreground/30">
                  <CardHeader>
                    <Icon className="mb-2 h-6 w-6 text-muted-foreground" />
                    <CardTitle className="text-base">{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Recent transactions
                <Badge variant="secondary">{productCount} products in catalog</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(sale.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="uppercase">
                          {sale.payment_method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(sale.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {recent.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No recent sales. Start one from the Sales section.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  Icon: typeof ShoppingCart;
  tone?: "default" | "warning";
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardDescription>{label}</CardDescription>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardTitle className={cn("text-3xl", tone === "warning" && "text-destructive")}>
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}