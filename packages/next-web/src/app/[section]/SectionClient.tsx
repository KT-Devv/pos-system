"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { calculateSaleTotal, formatCurrency } from "@pos/shared";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { queueDesktopSale, syncDesktopSales } from "../../lib/desktop";

type Section = "sales" | "products" | "inventory" | "customers" | "reports" | "settings";
type Product = { id: string; name: string; cost_price: number; selling_price: number; stock: number; barcode: string | null };
type Customer = { id: string; name: string; phone: string | null; email: string | null; loyalty_points: number };
type CartLine = Product & { quantity: number };

const sections: Record<Section, { title: string; description: string }> = {
  sales: { title: "Sales", description: "Build a cart and complete a stock-safe checkout." },
  products: { title: "Products", description: "Manage prices, stock, and barcodes in one place." },
  inventory: { title: "Inventory", description: "Record stock movements and review current levels." },
  customers: { title: "Customers", description: "Maintain customer details and loyalty balances." },
  reports: { title: "Reports", description: "Review revenue, payment mix, and recent transactions." },
  settings: { title: "Settings", description: "Update the signed-in profile and shop preferences." },
};

const nav = Object.keys(sections) as Section[];

export default function SectionClient({ section }: { section: Section }) {
  const supabase = useMemo(
    () => (typeof window === "undefined" ? null : createSupabaseBrowserClient()),
    [],
  );
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getUser().then(async ({ data, error: authError }) => {
      if (authError) { if (active) setError(authError.message); return; }
      if (!data.user) { window.location.href = "/login"; return; }
      const { data: profile } = await supabase.from("profiles").select("name,role").eq("id", data.user.id).maybeSingle();
      if (active) setUser({ id: data.user.id, name: profile?.name ?? data.user.email ?? "User", role: profile?.role ?? "cashier" });
    });
    return () => { active = false; };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user || !navigator.onLine) return;
    void syncDesktopSales(async sale => {
      const { error } = await supabase.rpc("create_sale", {
        p_cashier_id: sale.cashierId,
        p_customer_id: sale.customerId,
        p_payment_method: sale.paymentMethod,
        p_discount: sale.discount,
        p_lines: sale.lines.map(line => ({ product_id: line.productId, quantity: line.quantity })),
      });
      if (error) throw error;
    }).catch(error => setError(error instanceof Error ? error.message : "Offline synchronization failed"));
  }, [supabase, user]);

  const signOut = async () => {
    await supabase?.auth.signOut();
    window.location.href = "/login";
  };

  if (!supabase || !user) return <main className="shell"><p className="muted">{error || "Loading workspace..."}</p></main>;
  const content = sections[section];

  return (
    <main className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand"><span>POS</span> System</Link>
        <p className="eyebrow">Workspace</p>
        <nav>{nav.map((item) => <Link className={item === section ? "nav-link active" : "nav-link"} href={`/${item}`} key={item}>{sections[item].title}</Link>)}</nav>
        <button className="text-button" onClick={signOut}>Sign out</button>
      </aside>
      <section className="content">
        <header className="page-header"><div><p className="eyebrow">Mom&apos;s Shop · {user.role}</p><h1>{content.title}</h1><p className="muted">{content.description}</p></div><div className="user-chip">{user.name}</div></header>
        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}
        {section === "sales" && <Sales supabase={supabase} userId={user.id} onError={setError} onNotice={setNotice} />}
        {section === "products" && <Products supabase={supabase} onError={setError} onNotice={setNotice} />}
        {section === "inventory" && <Inventory supabase={supabase} onError={setError} onNotice={setNotice} />}
        {section === "customers" && <Customers supabase={supabase} onError={setError} onNotice={setNotice} />}
        {section === "reports" && <Reports supabase={supabase} onError={setError} />}
        {section === "settings" && <Settings supabase={supabase} user={user} onError={setError} onNotice={setNotice} />}
      </section>
    </main>
  );
}

type Client = ReturnType<typeof createSupabaseBrowserClient>;
type Feedback = { onError: (message: string) => void; onNotice: (message: string) => void };
const fail = (onError: (message: string) => void, value: unknown) => onError(value instanceof Error ? value.message : String(value));

function Products({ supabase, onError, onNotice }: { supabase: Client } & Feedback) {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: "", cost: "", price: "", stock: "", barcode: "" });
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("products").select("id,name,cost_price,selling_price,stock,barcode").order("name");
    if (error) fail(onError, error); else setProducts((data ?? []) as Product[]);
  }, [supabase, onError]);
  useEffect(() => { void load(); }, [load]);
  const add = async (event: FormEvent) => {
    event.preventDefault();
    const payload = { name: form.name.trim(), cost_price: Number(form.cost), selling_price: Number(form.price), stock: Number(form.stock || 0), barcode: form.barcode.trim() || null };
    if (!payload.name || payload.cost_price < 0 || payload.selling_price <= 0 || !Number.isInteger(payload.stock) || payload.stock < 0) { onError("Enter a name, valid prices, and a whole-number stock quantity."); return; }
    const { error } = await supabase.from("products").insert(payload);
    if (error) { fail(onError, error); return; }
    setForm({ name: "", cost: "", price: "", stock: "", barcode: "" }); onNotice("Product added."); await load();
  };
  const remove = async (id: string) => { const { error } = await supabase.from("products").delete().eq("id", id); if (error) fail(onError, error); else { onNotice("Product deleted."); await load(); } };
  return <div className="stack"><form className="panel form-grid" onSubmit={add}><h2>Add product</h2><input required placeholder="Product name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input required type="number" min="0" step="0.01" placeholder="Cost price" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} /><input required type="number" min="0.01" step="0.01" placeholder="Selling price" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /><input type="number" min="0" step="1" placeholder="Opening stock" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} /><input placeholder="Barcode (optional)" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} /><button className="button" type="submit">Add product</button></form><div className="panel"><h2>Catalog <span className="count">{products.length}</span></h2><div className="table-wrap"><table><thead><tr><th>Name</th><th>Price</th><th>Stock</th><th>Barcode</th><th /></tr></thead><tbody>{products.map(product => <tr key={product.id}><td>{product.name}</td><td>{formatCurrency(product.selling_price)}</td><td className={product.stock === 0 ? "danger-text" : ""}>{product.stock}</td><td>{product.barcode || "—"}</td><td><button className="text-button danger-text" onClick={() => void remove(product.id)}>Delete</button></td></tr>)}</tbody></table>{products.length === 0 && <p className="muted empty">No products yet.</p>}</div></div></div>;
}

function Sales({ supabase, userId, onError, onNotice }: { supabase: Client; userId: string } & Feedback) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState<"cash" | "momo" | "card">("cash");
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [recent, setRecent] = useState<{ id: string; total: number; payment_method: string; created_at: string }[]>([]);
  const load = useCallback(async () => {
    const [{ data: catalog, error: catalogError }, { data: sales, error: salesError }, { data: customerRows, error: customerError }] = await Promise.all([
      supabase.from("products").select("id,name,cost_price,selling_price,stock,barcode").gt("stock", 0).order("name"),
      supabase.from("sales").select("id,total,payment_method,created_at").order("created_at", { ascending: false }).limit(8),
      supabase.from("customers").select("id,name,phone,email,loyalty_points").order("name"),
    ]);
    if (catalogError) fail(onError, catalogError); else setProducts((catalog ?? []) as Product[]);
    if (salesError) fail(onError, salesError); else setRecent((sales ?? []) as typeof recent);
    if (customerError) fail(onError, customerError); else setCustomers((customerRows ?? []) as Customer[]);
  }, [supabase, onError]);
  useEffect(() => { void load(); }, [load]);
  const filtered = products.filter(p => `${p.name} ${p.barcode ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const add = (product: Product) => setCart(current => current.some(item => item.id === product.id) ? current.map(item => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) } : item) : [...current, { ...product, quantity: 1 }]);
  const totals = calculateSaleTotal(cart.map(line => ({ productId: line.id, quantity: line.quantity, unitPrice: line.selling_price, unitCost: line.cost_price })), Number(discount) || 0);
  const checkout = async () => {
    if (!cart.length) { onError("Add at least one product to the cart."); return; }
    const id = crypto.randomUUID();
    const input = { cashierId: userId, paymentMethod: payment, discount: totals.discount, lines: cart.map(line => ({ productId: line.id, quantity: line.quantity, unitPrice: line.selling_price, unitCost: line.cost_price })) };
    try {
      if (!navigator.onLine) { await queueDesktopSale({ ...input, id }); onNotice("Sale queued for synchronization when online."); setCart([]); return; }
      const { error } = await supabase.rpc("create_sale", { p_cashier_id: userId, p_customer_id: customerId || null, p_payment_method: payment, p_discount: totals.discount, p_lines: cart.map(line => ({ product_id: line.id, quantity: line.quantity })) });
      if (error) throw error;
      onNotice(`Sale completed: ${formatCurrency(totals.total)}`); setCart([]); setDiscount("0"); await load();
    } catch (error) { fail(onError, error); }
  };
  return <div className="sales-grid"><div className="stack"><div className="panel"><input placeholder="Search by product or barcode" value={search} onChange={e => setSearch(e.target.value)} /><div className="product-grid">{filtered.map(product => <button className="product-tile" key={product.id} onClick={() => add(product)}><strong>{product.name}</strong><span>{formatCurrency(product.selling_price)}</span><small>{product.stock} in stock</small></button>)}</div></div><div className="panel"><h2>Recent sales</h2><div className="table-wrap"><table><tbody>{recent.map(sale => <tr key={sale.id}><td>{new Date(sale.created_at).toLocaleString()}</td><td>{sale.payment_method}</td><td>{formatCurrency(sale.total)}</td></tr>)}</tbody></table></div></div></div><div className="panel cart"><h2>Cart <span className="count">{cart.length}</span></h2>{cart.map(item => <div className="cart-line" key={item.id}><div><strong>{item.name}</strong><small>{formatCurrency(item.selling_price)} each</small></div><input aria-label={`Quantity for ${item.name}`} type="number" min="1" max={item.stock} value={item.quantity} onChange={e => setCart(current => current.map(line => line.id === item.id ? { ...line, quantity: Math.max(1, Math.min(item.stock, Number(e.target.value))) } : line))} /><button className="text-button danger-text" onClick={() => setCart(current => current.filter(line => line.id !== item.id))}>×</button></div>)}{!cart.length && <p className="muted empty">Your cart is empty.</p>}<div className="totals"><label>Customer<select value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">Walk-in customer</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label>Discount <input type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} /></label><p><span>Subtotal</span><strong>{formatCurrency(totals.subtotal)}</strong></p><p className="total"><span>Total</span><strong>{formatCurrency(totals.total)}</strong></p><select value={payment} onChange={e => setPayment(e.target.value as typeof payment)}><option value="cash">Cash</option><option value="momo">Mobile money</option><option value="card">Card</option></select><button className="button wide" onClick={() => void checkout}>Complete sale</button></div></div></div>;
}

function Inventory({ supabase, onError, onNotice }: { supabase: Client } & Feedback) {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [type, setType] = useState<"in" | "out" | "adjustment">("in");
  const [notes, setNotes] = useState("");
  const load = useCallback(async () => { const { data, error } = await supabase.from("products").select("id,name,cost_price,selling_price,stock,barcode").order("name"); if (error) fail(onError, error); else setProducts((data ?? []) as Product[]); }, [supabase, onError]);
  useEffect(() => { void load(); }, [load]);
  const save = async (event: FormEvent) => { event.preventDefault(); const amount = Number(quantity); if (!productId || !Number.isInteger(amount) || amount <= 0) { onError("Select a product and enter a positive whole-number quantity."); return; } const { error } = await supabase.rpc("record_stock_movement", { p_product_id: productId, p_type: type, p_quantity: amount, p_supplier_id: null, p_notes: notes.trim() || null }); if (error) { fail(onError, error); return; } onNotice("Stock movement recorded."); setQuantity(""); setNotes(""); await load(); };
  return <div className="stack"><form className="panel form-grid" onSubmit={save}><h2>Record movement</h2><select required value={productId} onChange={e => setProductId(e.target.value)}><option value="">Select product</option>{products.map(product => <option key={product.id} value={product.id}>{product.name} ({product.stock} on hand)</option>)}</select><select value={type} onChange={e => setType(e.target.value as typeof type)}><option value="in">Stock in</option><option value="out">Stock out</option><option value="adjustment">Adjustment</option></select><input required type="number" min="1" step="1" placeholder="Quantity" value={quantity} onChange={e => setQuantity(e.target.value)} /><input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} /><button className="button" type="submit">Save movement</button></form><div className="panel"><h2>Current stock</h2><div className="table-wrap"><table><thead><tr><th>Product</th><th>Stock</th><th>Value</th></tr></thead><tbody>{products.map(product => <tr key={product.id}><td>{product.name}</td><td className={product.stock < 5 ? "danger-text" : ""}>{product.stock}</td><td>{formatCurrency(product.stock * product.cost_price)}</td></tr>)}</tbody></table></div></div></div>;
}

function Customers({ supabase, onError, onNotice }: { supabase: Client } & Feedback) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const load = useCallback(async () => { const { data, error } = await supabase.from("customers").select("id,name,phone,email,loyalty_points").order("name"); if (error) fail(onError, error); else setCustomers((data ?? []) as Customer[]); }, [supabase, onError]);
  useEffect(() => { void load(); }, [load]);
  const add = async (event: FormEvent) => { event.preventDefault(); if (!form.name.trim()) { onError("Customer name is required."); return; } const { error } = await supabase.from("customers").insert({ name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null }); if (error) { fail(onError, error); return; } setForm({ name: "", phone: "", email: "" }); onNotice("Customer added."); await load(); };
  return <div className="stack"><form className="panel form-grid" onSubmit={add}><h2>Add customer</h2><input required placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /><input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /><button className="button" type="submit">Add customer</button></form><div className="panel"><h2>Customers <span className="count">{customers.length}</span></h2><div className="table-wrap"><table><thead><tr><th>Name</th><th>Contact</th><th>Loyalty points</th></tr></thead><tbody>{customers.map(customer => <tr key={customer.id}><td>{customer.name}</td><td>{customer.phone || customer.email || "—"}</td><td>{customer.loyalty_points}</td></tr>)}</tbody></table></div></div></div>;
}

function Reports({ supabase, onError }: { supabase: Client; onError: (message: string) => void }) {
  const [sales, setSales] = useState<{ id: string; total: number; payment_method: string; created_at: string }[]>([]);
  useEffect(() => { supabase.from("sales").select("id,total,payment_method,created_at").order("created_at", { ascending: false }).limit(100).then(({ data, error }) => { if (error) fail(onError, error); else setSales((data ?? []) as typeof sales); }); }, [supabase, onError]);
  const revenue = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const payments = sales.reduce<Record<string, number>>((result, sale) => ({ ...result, [sale.payment_method]: (result[sale.payment_method] ?? 0) + Number(sale.total) }), {});
  return <div className="stack"><div className="metric-grid"><div className="metric"><span>Transactions</span><strong>{sales.length}</strong></div><div className="metric"><span>Revenue</span><strong>{formatCurrency(revenue)}</strong></div><div className="metric"><span>Average sale</span><strong>{formatCurrency(sales.length ? revenue / sales.length : 0)}</strong></div></div><div className="panel"><h2>Payment mix</h2>{Object.entries(payments).map(([method, amount]) => <p className="report-row" key={method}><span>{method}</span><strong>{formatCurrency(amount)}</strong></p>)}{!sales.length && <p className="muted empty">No sales recorded yet.</p>}</div><div className="panel"><h2>Recent transactions</h2><div className="table-wrap"><table><tbody>{sales.slice(0, 20).map(sale => <tr key={sale.id}><td>{new Date(sale.created_at).toLocaleString()}</td><td>{sale.payment_method}</td><td>{formatCurrency(sale.total)}</td></tr>)}</tbody></table></div></div></div>;
}

function Settings({ supabase, user, onError, onNotice }: { supabase: Client; user: { id: string; name: string; role: string } } & Feedback) {
  const [name, setName] = useState(user.name);
  const save = async (event: FormEvent) => { event.preventDefault(); if (!name.trim()) { onError("Name is required."); return; } const { error } = await supabase.from("profiles").update({ name: name.trim() }).eq("id", user.id); if (error) fail(onError, error); else onNotice("Profile updated."); };
  return <form className="panel form-grid narrow" onSubmit={save}><h2>Profile</h2><label>Email<input disabled value="Signed-in account" /></label><label>Display name<input required value={name} onChange={e => setName(e.target.value)} /></label><label>Role<input disabled value={user.role} /></label><button className="button" type="submit">Save profile</button></form>;
}
