import Link from "next/link";
import { notFound } from "next/navigation";

const sections = {
  sales: {
    title: "Sales",
    description: "Process checkout, scan products, and review recent transactions.",
    actions: ["New sale", "Scan barcode", "View receipts"],
  },
  products: {
    title: "Products",
    description: "Manage your catalog, pricing, categories, and product barcodes.",
    actions: ["Add product", "Import catalog", "Manage categories"],
  },
  inventory: {
    title: "Inventory",
    description: "Track stock on hand, stock movements, suppliers, and low-stock alerts.",
    actions: ["Stock in", "Stock adjustment", "View history"],
  },
  customers: {
    title: "Customers",
    description: "Manage customers, contact details, and loyalty points.",
    actions: ["Add customer", "Search customers", "Loyalty overview"],
  },
  reports: {
    title: "Reports",
    description: "Review sales, profit, payment methods, and best-selling products.",
    actions: ["Daily report", "Weekly report", "Export report"],
  },
  settings: {
    title: "Settings",
    description: "Configure the shop, receipt preferences, payment methods, and account.",
    actions: ["Shop profile", "Receipt settings", "Team access"],
  },
} as const;

export function generateStaticParams() {
  return Object.keys(sections).map((section) => ({ section }));
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const content = sections[section as keyof typeof sections];
  if (!content) notFound();

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-semibold">POS System</Link>
          <Link href="/login" className="text-sm text-neutral-600 hover:text-neutral-950">Sign in</Link>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-500">Workspace</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">{content.title}</h1>
        <p className="mt-3 max-w-2xl text-lg text-neutral-600">{content.description}</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {content.actions.map((action) => (
            <div key={action} className="rounded-xl border bg-white p-5">
              <h2 className="font-semibold">{action}</h2>
              <p className="mt-2 text-sm text-neutral-500">This workflow is ready for the Supabase data adapter.</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
