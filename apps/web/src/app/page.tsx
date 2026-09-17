import Link from "next/link";
import { formatCurrency } from "@pos/shared";

const sections = [
  ["Sales", "Record transactions and manage the checkout queue.", "/sales"],
  ["Products", "Manage pricing, barcodes, and stock levels.", "/products"],
  ["Inventory", "Track stock movements and suppliers.", "/inventory"],
  ["Reports", "Review revenue, profit, and payment trends.", "/reports"],
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">POS System</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Mom&apos;s Shop</h1>
          </div>
          <Link className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white" href="/login">
            Sign in
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-neutral-500">Retail operations</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight">Everything you need to run the counter.</h2>
          <p className="mt-4 text-lg text-neutral-600">
            A fast, reliable workspace for sales, inventory, customers, and reporting.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map(([title, description, href]) => (
            <Link key={href} href={href} className="rounded-xl border bg-white p-5 hover:border-neutral-900">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p>
            </Link>
          ))}
        </div>
        <p className="mt-10 text-sm text-neutral-500">Currency: {formatCurrency(0)}</p>
      </section>
    </main>
  );
}
