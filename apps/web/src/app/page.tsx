import Link from "next/link";
import { formatCurrency, Button, Card, CardDescription, CardHeader, CardTitle } from "@pos/shared";
import { BarChart3, Package, Settings, ShoppingCart, Truck, Users } from "lucide-react";

const sections = [
  ["Sales", "Record transactions and manage the checkout queue.", "/sales", ShoppingCart],
  ["Products", "Manage pricing, barcodes, and stock levels.", "/products", Package],
  ["Inventory", "Track stock movements and suppliers.", "/inventory", Truck],
  ["Customers", "Keep contact details and loyalty balances.", "/customers", Users],
  ["Reports", "Review revenue, profit, and payment trends.", "/reports", BarChart3],
  ["Settings", "Update the signed-in profile and shop preferences.", "/settings", Settings],
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              POS
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                POS System
              </p>
              <p className="text-lg font-bold tracking-tight">Mom&apos;s Shop</p>
            </div>
          </div>
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-14">
        <section className="max-w-2xl">
          <p className="text-sm font-semibold text-muted-foreground">Retail operations</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">Everything you need to run the counter.</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            A fast, reliable workspace for sales, inventory, customers, and reporting.
          </p>
        </section>
        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map(([title, description, href, Icon]) => (
            <Link key={href} href={href} className="block outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="h-full hover:border-foreground/30">
                <CardHeader>
                  <Icon className="mb-2 h-6 w-6 text-muted-foreground" />
                  <CardTitle className="text-base">{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </section>
        <p className="mt-10 text-sm text-muted-foreground">Currency: {formatCurrency(0)}</p>
      </main>
    </div>
  );
}