"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  calculateSaleTotal,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  formatCurrency,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@pos/shared";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  LogOut,
  Package,
  Pencil,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShoppingCart,
  Trash2,
  Truck,
  Users,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase/browser";
import { isTauri, queueDesktopSale, syncDesktopSales } from "../../lib/desktop";

type Section = "sales" | "products" | "inventory" | "customers" | "reports" | "settings";
type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  category_id: string | null;
  cost_price: number;
  selling_price: number;
  stock: number;
  barcode: string | null;
  categories?: { name: string } | null;
};
type Supplier = { id: string; name: string; phone: string | null; email: string | null; address: string | null };
type Customer = { id: string; name: string; phone: string | null; email: string | null; loyalty_points: number };
type CartLine = Product & { quantity: number };
type Option = { value: string; label: string };

const sections: Record<Section, { title: string; description: string }> = {
  sales: { title: "Sales", description: "Build a cart and complete a stock-safe checkout." },
  products: { title: "Products", description: "Manage prices, stock, categories, and barcodes in one place." },
  inventory: { title: "Inventory", description: "Record stock movements and manage suppliers." },
  customers: { title: "Customers", description: "Maintain customer details and loyalty balances." },
  reports: { title: "Reports", description: "Review revenue, profit margins, payment mix, and recent transactions." },
  settings: { title: "Settings", description: "Update the signed-in profile and shop preferences." },
};

const nav = Object.keys(sections) as Section[];
const navIcons: Record<Section, typeof ShoppingCart> = {
  sales: ShoppingCart,
  products: Package,
  inventory: Truck,
  customers: Users,
  reports: BarChart3,
  settings: SettingsIcon,
};
const WALK_IN = "walk-in";

export default function SectionClient({ section }: { section: Section }) {
  const configured = isSupabaseConfigured();
  const supabase = useMemo(
    () => (typeof window === "undefined" || !configured ? null : createSupabaseBrowserClient()),
    [configured],
  );
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reportError = useCallback((message: string) => {
    setNotice("");
    setError(message);
  }, []);
  const reportNotice = useCallback((message: string) => {
    setError("");
    setNotice(message);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getUser().then(async ({ data, error: authError }) => {
      if (!data.user || authError?.name === "AuthSessionMissingError") {
        if (active) window.location.replace("/login");
        return;
      }
      if (authError) { if (active) setError(authError.message); return; }
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
    }).catch(error => reportError(error instanceof Error ? error.message : "Offline synchronization failed"));
  }, [supabase, user, reportError]);

  const signOut = async () => {
    await supabase?.auth.signOut();
    window.location.href = "/login";
  };

  if (!configured) {
    return (
      <main className="grid min-h-screen place-items-center px-6 py-12">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Connect your workspace</CardTitle>
            <CardDescription>
              Add your Supabase project URL and anonymous key to <code>apps/web/.env.local</code>,
              then restart the development server.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }
  if (!supabase || !user) {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        {error || "Loading workspace..."}
      </main>
    );
  }
  const content = sections[section];
  const ActiveIcon = navIcons[section];
  const signOutMobile = signOut;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card px-4 py-6 md:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">POS</span>
          <span className="font-semibold tracking-tight">POS System</span>
        </Link>
        <p className="mt-8 mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Workspace</p>
        <nav className="grid gap-1">
          {nav.map((item) => {
            const Icon = navIcons[item];
            return (
              <Link
                key={item}
                href={`/${item}`}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  item === section && "bg-accent font-medium text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {sections[item].title}
              </Link>
            );
          })}
        </nav>
        <Button variant="ghost" className="mt-auto justify-start text-muted-foreground" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b bg-card md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">POS</span>
              POS System
            </Link>
            <Button variant="ghost" size="sm" onClick={signOutMobile}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-4 pb-3">
            {nav.map((item) => (
              <Link
                key={item}
                href={`/${item}`}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  item === section && "bg-accent font-medium text-foreground",
                )}
              >
                {sections[item].title}
              </Link>
            ))}
          </nav>
        </header>

        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                <ActiveIcon className="h-4 w-4" />
                Mom&apos;s Shop · {user.role}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">{content.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{content.description}</p>
            </div>
            <Badge variant="secondary" className="px-3 py-1">{user.name}</Badge>
          </div>

          <div className="mt-4 grid gap-2">
            {notice && (
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <main className="mt-6 grid gap-4">
            {section === "sales" && <Sales supabase={supabase} userId={user.id} onError={reportError} onNotice={reportNotice} />}
            {section === "products" && <Products supabase={supabase} onError={reportError} onNotice={reportNotice} />}
            {section === "inventory" && <Inventory supabase={supabase} onError={reportError} onNotice={reportNotice} />}
            {section === "customers" && <Customers supabase={supabase} onError={reportError} onNotice={reportNotice} />}
            {section === "reports" && <Reports supabase={supabase} onError={reportError} />}
            {section === "settings" && <Settings supabase={supabase} user={user} onError={reportError} onNotice={reportNotice} />}
          </main>
        </div>
      </div>
    </div>
  );
}

type Client = ReturnType<typeof createSupabaseBrowserClient>;
type Feedback = { onError: (message: string) => void; onNotice: (message: string) => void };
const fail = (onError: (message: string) => void, value: unknown) => onError(value instanceof Error ? value.message : String(value));

function MenuSelect({
  id,
  value,
  placeholder,
  options,
  onValueChange,
}: {
  id?: string;
  value: string;
  placeholder: string;
  options: Option[];
  onValueChange: (value: string) => void;
}) {
  const selectedValue = value || "";
  return (
    <Select value={selectedValue || undefined} onValueChange={onValueChange}>
      <SelectTrigger id={id} className="h-10 w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={6}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Products({ supabase, onError, onNotice }: { supabase: Client } & Feedback) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [form, setForm] = useState({ name: "", category_id: "", cost: "", price: "", stock: "", barcode: "" });
  const [newCatName, setNewCatName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const load = useCallback(async () => {
    const [{ data: prodRows, error: prodError }, { data: catRows, error: catError }] = await Promise.all([
      supabase.from("products").select("id,name,category_id,cost_price,selling_price,stock,barcode,categories(name)").order("name"),
      supabase.from("categories").select("id,name").order("name"),
    ]);
    if (prodError) fail(onError, prodError); else setProducts((prodRows ?? []) as unknown as Product[]);
    if (catError) fail(onError, catError); else setCategories((catRows ?? []) as Category[]);
  }, [supabase, onError]);

  useEffect(() => { void load(); }, [load]);

  const addCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: newCatName.trim() });
    if (error) { fail(onError, error); return; }
    setNewCatName("");
    setShowAddCategory(false);
    onNotice("Category added.");
    await load();
  };

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      name: form.name.trim(),
      category_id: form.category_id || null,
      cost_price: Number(form.cost),
      selling_price: Number(form.price),
      stock: Number(form.stock || 0),
      barcode: form.barcode.trim() || null,
    };
    if (!payload.name || payload.cost_price < 0 || payload.selling_price <= 0 || !Number.isInteger(payload.stock) || payload.stock < 0) {
      onError("Enter a name, valid prices, and a whole-number stock quantity.");
      return;
    }
    const { error } = await supabase.from("products").insert(payload);
    if (error) { fail(onError, error); return; }
    setForm({ name: "", category_id: "", cost: "", price: "", stock: "", barcode: "" });
    onNotice("Product added.");
    await load();
  };

  const updateProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    const payload = {
      name: editingProduct.name.trim(),
      category_id: editingProduct.category_id || null,
      cost_price: Number(editingProduct.cost_price),
      selling_price: Number(editingProduct.selling_price),
      stock: Number(editingProduct.stock),
      barcode: editingProduct.barcode ? editingProduct.barcode.trim() : null,
    };
    if (!payload.name || payload.cost_price < 0 || payload.selling_price <= 0 || !Number.isInteger(payload.stock) || payload.stock < 0) {
      onError("Valid product details are required.");
      return;
    }
    const { error } = await supabase.from("products").update(payload).eq("id", editingProduct.id);
    if (error) { fail(onError, error); return; }
    setEditingProduct(null);
    onNotice("Product updated.");
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) fail(onError, error);
    else { onNotice("Product deleted."); await load(); }
  };

  const filteredProducts = selectedCategory === "all"
    ? products
    : products.filter(p => p.category_id === selectedCategory);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Add product</CardTitle>
            <CardDescription>Create a new product with pricing and stock.</CardDescription>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddCategory(!showAddCategory)}>
            <Plus className="h-4 w-4" />
            New category
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="grid gap-4 sm:grid-cols-2">
            {showAddCategory && (
              <div className="sm:col-span-2 rounded-lg border bg-muted/50 p-3">
                <div className="grid gap-2">
                  <Label htmlFor="new-category">Category name</Label>
                  <div className="flex gap-2">
                    <Input
                      id="new-category"
                      placeholder="e.g. Beverages"
                      value={newCatName}
                      onChange={e => setNewCatName(e.target.value)}
                    />
                    <Button type="button" onClick={e => void addCategory(e)}>Save</Button>
                  </div>
                </div>
              </div>
            )}
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="product-name">Product name</Label>
              <Input id="product-name" required placeholder="Product name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Category</Label>
              <MenuSelect
                value={form.category_id}
                placeholder="Select category (optional)"
                onValueChange={val => setForm({ ...form, category_id: val })}
                options={categories.map(c => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-cost">Cost price</Label>
              <Input id="product-cost" required type="number" min="0" step="0.01" placeholder="0.00" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-price">Selling price</Label>
              <Input id="product-price" required type="number" min="0.01" step="0.01" placeholder="0.00" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-stock">Opening stock</Label>
              <Input id="product-stock" type="number" min="0" step="1" placeholder="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-barcode">Barcode</Label>
              <Input id="product-barcode" placeholder="Optional" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
            </div>
            <Button type="submit" className="justify-self-start sm:col-span-2">
              Add product
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              Catalog
              <Badge variant="secondary">{filteredProducts.length}</Badge>
            </CardTitle>
            <CardDescription>Browse, edit, or remove catalog items.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={selectedCategory === "all" ? "default" : "outline"} onClick={() => setSelectedCategory("all")}>All</Button>
            {categories.map(cat => (
              <Button key={cat.id} type="button" size="sm" variant={selectedCategory === cat.id ? "default" : "outline"} onClick={() => setSelectedCategory(cat.id)}>{cat.name}</Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map(product => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground">{product.categories?.name || "—"}</TableCell>
                  <TableCell>{formatCurrency(product.cost_price)}</TableCell>
                  <TableCell>{formatCurrency(product.selling_price)}</TableCell>
                  <TableCell>
                    {product.stock === 0
                      ? <span className="font-semibold text-destructive">{product.stock}</span>
                      : product.stock}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{product.barcode || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingProduct(product)}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void remove(product.id)}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredProducts.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No products found.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingProduct)} onOpenChange={(open) => { if (!open) setEditingProduct(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update the product details below.</DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <>
              <form id="edit-product-form" onSubmit={updateProduct} className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="edit-name">Product name</Label>
                  <Input id="edit-name" required value={editingProduct.name} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Category</Label>
                  <MenuSelect
                    value={editingProduct.category_id || ""}
                    placeholder="No category"
                    onValueChange={val => setEditingProduct({ ...editingProduct, category_id: val })}
                    options={categories.map(c => ({ value: c.id, label: c.name }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-cost">Cost price</Label>
                  <Input id="edit-cost" required type="number" min="0" step="0.01" value={editingProduct.cost_price} onChange={e => setEditingProduct({ ...editingProduct, cost_price: Number(e.target.value) })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-price">Selling price</Label>
                  <Input id="edit-price" required type="number" min="0.01" step="0.01" value={editingProduct.selling_price} onChange={e => setEditingProduct({ ...editingProduct, selling_price: Number(e.target.value) })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-stock">Stock</Label>
                  <Input id="edit-stock" required type="number" min="0" step="1" value={editingProduct.stock} onChange={e => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-barcode">Barcode</Label>
                  <Input id="edit-barcode" value={editingProduct.barcode || ""} onChange={e => setEditingProduct({ ...editingProduct, barcode: e.target.value })} />
                </div>
              </form>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingProduct(null)}>Cancel</Button>
                <Button type="submit" form="edit-product-form">Save changes</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Sales({ supabase, userId, onError, onNotice }: { supabase: Client; userId: string } & Feedback) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState("all");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState<"cash" | "momo" | "card">("cash");
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [recent, setRecent] = useState<{ id: string; total: number; payment_method: string; created_at: string }[]>([]);

  const load = useCallback(async () => {
    const [{ data: catalog, error: catalogError }, { data: sales, error: salesError }, { data: customerRows, error: customerError }, { data: catRows }] = await Promise.all([
      supabase.from("products").select("id,name,category_id,cost_price,selling_price,stock,barcode").gt("stock", 0).order("name"),
      supabase.from("sales").select("id,total,payment_method,created_at").order("created_at", { ascending: false }).limit(8),
      supabase.from("customers").select("id,name,phone,email,loyalty_points").order("name"),
      supabase.from("categories").select("id,name").order("name"),
    ]);
    if (catalogError) fail(onError, catalogError); else setProducts((catalog ?? []) as Product[]);
    if (salesError) fail(onError, salesError); else setRecent((sales ?? []) as typeof recent);
    if (customerError) fail(onError, customerError); else setCustomers((customerRows ?? []) as Customer[]);
    if (catRows) setCategories((catRows ?? []) as Category[]);
  }, [supabase, onError]);

  useEffect(() => { void load(); }, [load]);

  const filtered = products.filter(p => {
    const matchCat = selectedCat === "all" || p.category_id === selectedCat;
    const matchSearch = `${p.name} ${p.barcode ?? ""}`.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const selectedCustomer = customers.find(c => c.id === customerId);

  const add = (product: Product) => setCart(current =>
    current.some(item => item.id === product.id)
      ? current.map(item => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) } : item)
      : [...current, { ...product, quantity: 1 }]
  );

  const updateQuantity = (id: string, rawVal: string, maxStock: number) => {
    const parsed = parseInt(rawVal, 10);
    const validQty = isNaN(parsed) || parsed < 1 ? 1 : Math.min(parsed, maxStock);
    setCart(current => current.map(line => line.id === id ? { ...line, quantity: validQty } : line));
  };

  const totals = calculateSaleTotal(
    cart.map(line => ({ productId: line.id, quantity: line.quantity, unitPrice: line.selling_price, unitCost: line.cost_price })),
    Number(discount) || 0,
  );

  const checkout = async () => {
    if (!cart.length) { onError("Add at least one product to the cart."); return; }
    const id = crypto.randomUUID();
    const input = {
      cashierId: userId,
      customerId: customerId || null,
      paymentMethod: payment,
      discount: totals.discount,
      lines: cart.map(line => ({ productId: line.id, quantity: line.quantity, unitPrice: line.selling_price, unitCost: line.cost_price })),
    };
    try {
      if (!navigator.onLine) {
        if (isTauri()) {
          await queueDesktopSale({ ...input, id });
          onNotice("Sale queued for desktop synchronization when online.");
          setCart([]);
          return;
        } else {
          onError("Offline sales checkout is only supported in the desktop app. Please reconnect to complete your purchase.");
          return;
        }
      }
      const { error } = await supabase.rpc("create_sale", {
        p_cashier_id: userId,
        p_customer_id: customerId || null,
        p_payment_method: payment,
        p_discount: totals.discount,
        p_lines: cart.map(line => ({ product_id: line.id, quantity: line.quantity })),
      });
      if (error) throw error;
      onNotice(`Sale completed: ${formatCurrency(totals.total)}`);
      setCart([]);
      setDiscount("0");
      await load();
    } catch (error) { fail(onError, error); }
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
      <div className="grid gap-4">
        <Card>
          <CardContent className="grid gap-4 p-4 sm:p-6 sm:pt-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by product name or barcode"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant={selectedCat === "all" ? "default" : "outline"} onClick={() => setSelectedCat("all")}>
                  All categories
                </Button>
                {categories.map(cat => (
                  <Button key={cat.id} type="button" size="sm" variant={selectedCat === cat.id ? "default" : "outline"} onClick={() => setSelectedCat(cat.id)}>
                    {cat.name}
                  </Button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filtered.map(product => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => add(product)}
                  className="flex min-h-[105px] flex-col items-start gap-1 rounded-lg border border-border bg-card p-3 text-left hover:border-foreground/40"
                >
                  <strong className="text-sm">{product.name}</strong>
                  <span className="text-sm font-semibold">{formatCurrency(product.selling_price)}</span>
                  <small className="text-muted-foreground">{product.stock} in stock</small>
                </button>
              ))}
            </div>
            {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground">No products found.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent sales</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableBody>
                {recent.map(sale => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-muted-foreground">{new Date(sale.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="uppercase">{sale.payment_method}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(sale.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {recent.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No recent sales.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Cart
            <Badge variant="secondary">{cart.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div>
            {cart.map(item => (
              <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_4rem_2.25rem] items-center gap-2 border-b py-3 last:border-0">
                <div className="min-w-0">
                  <strong className="block truncate text-sm">{item.name}</strong>
                  <small className="text-muted-foreground">{formatCurrency(item.selling_price)} each</small>
                </div>
                <Input
                  aria-label={`Quantity for ${item.name}`}
                  type="number"
                  min="1"
                  max={item.stock}
                  value={item.quantity}
                  onChange={e => updateQuantity(item.id, e.target.value, item.stock)}
                  className="h-8 px-2 text-center"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setCart(current => current.filter(line => line.id !== item.id))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {!cart.length && <p className="py-2 text-sm text-muted-foreground">Your cart is empty.</p>}
          </div>
        </CardContent>
        <CardContent className="grid gap-3 border-t pt-4">
          <div className="grid gap-2">
            <Label>Customer</Label>
            <MenuSelect
              value={customerId || WALK_IN}
              placeholder="Walk-in customer"
              onValueChange={(value) => setCustomerId(value === WALK_IN ? "" : value)}
              options={[
                { value: WALK_IN, label: "Walk-in customer" },
                ...customers.map((customer) => ({
                  value: customer.id,
                  label: `${customer.name} (${customer.loyalty_points} pts)`,
                })),
              ]}
            />
            {selectedCustomer && (
              <p className="text-xs font-medium text-success">
                Loyalty balance: {selectedCustomer.loyalty_points} points
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sale-discount">Discount</Label>
            <Input id="sale-discount" type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span className="font-semibold text-foreground">{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2 text-base">
            <span className="font-medium">Total</span>
            <span className="text-xl font-bold tracking-tight">{formatCurrency(totals.total)}</span>
          </div>
          <div className="grid gap-2">
            <Label>Payment method</Label>
            <MenuSelect
              value={payment}
              placeholder="Payment method"
              onValueChange={(value) => setPayment(value as typeof payment)}
              options={[
                { value: "cash", label: "Cash" },
                { value: "momo", label: "Mobile money" },
                { value: "card", label: "Card" },
              ]}
            />
          </div>
          <Button className="w-full" onClick={() => void checkout()}>
            Complete sale
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Inventory({ supabase, onError, onNotice }: { supabase: Client } & Feedback) {
  const [activeTab, setActiveTab] = useState<"movements" | "suppliers">("movements");
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [productId, setProductId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [type, setType] = useState<"in" | "out" | "adjustment">("in");
  const [notes, setNotes] = useState("");
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "", address: "" });

  const load = useCallback(async () => {
    const [{ data: prodData, error: prodError }, { data: suppData, error: suppError }] = await Promise.all([
      supabase.from("products").select("id,name,cost_price,selling_price,stock,barcode").order("name"),
      supabase.from("suppliers").select("id,name,phone,email,address").order("name"),
    ]);
    if (prodError) fail(onError, prodError); else setProducts((prodData ?? []) as Product[]);
    if (suppError) fail(onError, suppError); else setSuppliers((suppData ?? []) as Supplier[]);
  }, [supabase, onError]);

  useEffect(() => { void load(); }, [load]);

  const saveMovement = async (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(quantity);
    if (!productId || !Number.isInteger(amount) || amount <= 0) {
      onError("Select a product and enter a positive whole-number quantity.");
      return;
    }
    const { error } = await supabase.rpc("record_stock_movement", {
      p_product_id: productId,
      p_type: type,
      p_quantity: amount,
      p_supplier_id: supplierId || null,
      p_notes: notes.trim() || null,
    });
    if (error) { fail(onError, error); return; }
    onNotice("Stock movement recorded.");
    setQuantity("");
    setNotes("");
    setSupplierId("");
    await load();
  };

  const addSupplier = async (e: FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) { onError("Supplier name is required."); return; }
    const { error } = await supabase.from("suppliers").insert({
      name: supplierForm.name.trim(),
      phone: supplierForm.phone.trim() || null,
      email: supplierForm.email.trim() || null,
      address: supplierForm.address.trim() || null,
    });
    if (error) { fail(onError, error); return; }
    setSupplierForm({ name: "", phone: "", email: "", address: "" });
    onNotice("Supplier added.");
    await load();
  };

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "movements" | "suppliers")}>
      <TabsList>
        <TabsTrigger value="movements">Stock movements</TabsTrigger>
        <TabsTrigger value="suppliers">Suppliers ({suppliers.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="movements" className="mt-4">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Record stock movement</CardTitle>
              <CardDescription>Adjust stock on hand for a product.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveMovement} className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Product</Label>
                  <MenuSelect
                    value={productId}
                    placeholder="Select product"
                    onValueChange={setProductId}
                    options={products.map((product) => ({ value: product.id, label: `${product.name} (${product.stock} on hand)` }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Movement type</Label>
                  <MenuSelect
                    value={type}
                    placeholder="Select type"
                    onValueChange={(value) => setType(value as typeof type)}
                    options={[
                      { value: "in", label: "Stock in" },
                      { value: "out", label: "Stock out" },
                      { value: "adjustment", label: "Adjustment" },
                    ]}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="movement-qty">Quantity</Label>
                  <Input id="movement-qty" required type="number" min="1" step="1" placeholder="Quantity" value={quantity} onChange={e => setQuantity(e.target.value)} />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Supplier (optional)</Label>
                  <MenuSelect
                    value={supplierId}
                    placeholder="Select supplier"
                    onValueChange={setSupplierId}
                    options={[{ value: "", label: "None" }, ...suppliers.map((sup) => ({ value: sup.id, label: sup.name }))]}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="movement-notes">Notes</Label>
                  <Textarea id="movement-notes" placeholder="Notes / invoice reference (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
                <Button type="submit" className="justify-self-start sm:col-span-2">
                  Save movement
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current stock levels</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Unit cost</TableHead>
                    <TableHead className="text-right">Total valuation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map(product => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>
                        {product.stock < 5
                          ? <span className="font-semibold text-destructive">{product.stock}</span>
                          : product.stock}
                      </TableCell>
                      <TableCell>{formatCurrency(product.cost_price)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(product.stock * product.cost_price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="suppliers" className="mt-4">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add supplier</CardTitle>
              <CardDescription>Register a company or contact you buy from.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={addSupplier} className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="supplier-name">Supplier name</Label>
                  <Input id="supplier-name" required placeholder="Company or contact name" value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supplier-phone">Phone</Label>
                  <Input id="supplier-phone" placeholder="Phone number" value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supplier-email">Email</Label>
                  <Input id="supplier-email" type="email" placeholder="Email address" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="supplier-address">Address</Label>
                  <Input id="supplier-address" placeholder="Physical address" value={supplierForm.address} onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })} />
                </div>
                <Button type="submit" className="justify-self-start sm:col-span-2">
                  Add supplier
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Registered suppliers
                <Badge variant="secondary">{suppliers.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map(sup => (
                    <TableRow key={sup.id}>
                      <TableCell className="font-medium">{sup.name}</TableCell>
                      <TableCell className="text-muted-foreground">{sup.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{sup.email || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{sup.address || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {suppliers.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">No suppliers registered yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function Customers({ supabase, onError, onNotice }: { supabase: Client } & Feedback) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("customers").select("id,name,phone,email,loyalty_points").order("name");
    if (error) fail(onError, error); else setCustomers((data ?? []) as Customer[]);
  }, [supabase, onError]);

  useEffect(() => { void load(); }, [load]);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) { onError("Customer name is required."); return; }
    const { error } = await supabase.from("customers").insert({ name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null });
    if (error) { fail(onError, error); return; }
    setForm({ name: "", phone: "", email: "" });
    onNotice("Customer added.");
    await load();
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add customer</CardTitle>
          <CardDescription>Keep contact details for loyalty tracking.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="customer-name">Full name</Label>
              <Input id="customer-name" required placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customer-phone">Phone</Label>
              <Input id="customer-phone" placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customer-email">Email</Label>
              <Input id="customer-email" type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <Button type="submit" className="justify-self-start sm:col-span-2">
              Add customer
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Customers
            <Badge variant="secondary">{customers.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Loyalty points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map(customer => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-muted-foreground">{customer.phone || customer.email || "—"}</TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold text-success">{customer.loyalty_points} pts</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {customers.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No customers added yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Reports({ supabase, onError }: { supabase: Client; onError: (message: string) => void }) {
  const [sales, setSales] = useState<{ id: string; total: number; discount: number; payment_method: string; created_at: string }[]>([]);
  const [saleLines, setSaleLines] = useState<{ sale_id: string; quantity: number; unit_price: number; unit_cost: number }[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("sales").select("id,total,discount,payment_method,created_at").order("created_at", { ascending: false }),
      supabase.from("sale_lines").select("sale_id,quantity,unit_price,unit_cost"),
    ]).then(([{ data: salesData, error: salesErr }, { data: linesData, error: linesErr }]) => {
      if (salesErr) fail(onError, salesErr);
      else setSales((salesData ?? []) as typeof sales);
      if (linesErr) fail(onError, linesErr);
      else setSaleLines((linesData ?? []) as typeof saleLines);
    });
  }, [supabase, onError]);

  const revenue = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const totalCogs = saleLines.reduce((sum, line) => sum + (Number(line.quantity) * Number(line.unit_cost)), 0);
  const grossProfit = revenue - totalCogs;
  const payments = sales.reduce<Record<string, number>>((result, sale) => ({ ...result, [sale.payment_method]: (result[sale.payment_method] ?? 0) + Number(sale.total) }), {});

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Transactions</CardDescription>
            <CardTitle className="text-3xl">{sales.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(revenue)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Gross Profit</CardDescription>
            <CardTitle className={cn("text-3xl", grossProfit >= 0 ? "text-success" : "text-destructive")}>
              {formatCurrency(grossProfit)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Avg Sale</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(sales.length ? revenue / sales.length : 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment mix</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-1">
            {Object.entries(payments).map(([method, amount]) => (
              <div key={method} className="flex items-center justify-between border-b py-3 last:border-0">
                <Badge variant="secondary" className="uppercase">{method}</Badge>
                <span className="font-semibold">{formatCurrency(amount)}</span>
              </div>
            ))}
            {!sales.length && <p className="py-4 text-center text-sm text-muted-foreground">No sales recorded yet.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent transactions</CardTitle>
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
              {sales.slice(0, 30).map(sale => (
                <TableRow key={sale.id}>
                  <TableCell className="text-muted-foreground">{new Date(sale.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="uppercase">{sale.payment_method}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(sale.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Settings({ supabase, user, onError, onNotice }: { supabase: Client; user: { id: string; name: string; role: string } } & Feedback) {
  const [name, setName] = useState(user.name);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { onError("Name is required."); return; }
    const { error } = await supabase.from("profiles").update({ name: name.trim() }).eq("id", user.id);
    if (error) fail(onError, error);
    else onNotice("Profile updated.");
  };

  const updatePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 6) { onError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { onError("Passwords do not match."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) fail(onError, error);
    else {
      setNewPassword("");
      setConfirmPassword("");
      onNotice("Account password updated successfully.");
    }
  };

  return (
    <div className="grid max-w-lg gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Update your display name and role.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="profile-name">Display name</Label>
              <Input id="profile-name" required value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-role">Role</Label>
              <Input id="profile-role" disabled value={user.role} />
            </div>
            <Button type="submit" className="justify-self-start">
              Save profile
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security & Password</CardTitle>
          <CardDescription>Update the password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={updatePassword} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" required type="password" placeholder="At least 6 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input id="confirm-password" required type="password" placeholder="Re-enter password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </div>
            <Button type="submit" className="justify-self-start">
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}