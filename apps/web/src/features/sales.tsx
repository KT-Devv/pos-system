"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  calculateSaleTotal,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
  formatCurrency,
  Input,
  loyaltyPointsFor,
  SegmentedControl,
  stockLevel,
  validateSaleInput,
} from "@pos/shared";
import { Check, Minus, PackageSearch, Plus, Receipt, ShoppingCart, Trash2 } from "lucide-react";
import { isTauri, queueDesktopSale } from "@/lib/desktop";
import { useWorkspace } from "@/lib/workspace";
import {
  type Category,
  type Client,
  type Customer,
  Field,
  type Feedback,
  fail,
  MenuSelect,
  MoneyInput,
  PAYMENT_METHODS,
  type PaymentMethodValue,
  paymentLabel,
  type Product,
  SearchInput,
} from "./common";

type CartLine = Product & { quantity: number };
type RecentSale = { id: string; total: number; payment_method: string; created_at: string };

const WALK_IN = "walk-in";

export function Sales({ supabase, userId, onError, onNotice }: { supabase: Client; userId: string } & Feedback) {
  const { shop } = useWorkspace();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState("all");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState<PaymentMethodValue>("cash");
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [cashReceived, setCashReceived] = useState("");
  const [recent, setRecent] = useState<RecentSale[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [charging, setCharging] = useState(false);

  const load = useCallback(async () => {
    const [{ data: catalog, error: catalogError }, { data: sales, error: salesError }, { data: customerRows, error: customerError }, { data: catRows }] = await Promise.all([
      supabase.from("products").select("id,name,category_id,cost_price,selling_price,stock,barcode").gt("stock", 0).order("name"),
      supabase.from("sales").select("id,total,payment_method,created_at").order("created_at", { ascending: false }).limit(8),
      supabase.from("customers").select("id,name,phone,email,loyalty_points").order("name"),
      supabase.from("categories").select("id,name").order("name"),
    ]);
    if (catalogError) fail(onError, catalogError); else setProducts((catalog ?? []) as Product[]);
    if (salesError) fail(onError, salesError); else setRecent((sales ?? []) as RecentSale[]);
    if (customerError) fail(onError, customerError); else setCustomers((customerRows ?? []) as Customer[]);
    if (catRows) setCategories((catRows ?? []) as Category[]);
    setLoaded(true);
  }, [supabase, onError]);

  useEffect(() => { void load(); }, [load]);

  const categoryName = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
  const inCart = useMemo(() => new Map(cart.map(line => [line.id, line.quantity])), [cart]);

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

  const setQuantity = (id: string, quantity: number, maxStock: number) =>
    setCart(current => current.map(line => line.id === id ? { ...line, quantity: Math.max(1, Math.min(quantity, maxStock)) } : line));

  const updateQuantity = (id: string, rawVal: string, maxStock: number) => {
    const parsed = parseInt(rawVal, 10);
    setQuantity(id, isNaN(parsed) ? 1 : parsed, maxStock);
  };

  const removeLine = (id: string) => setCart(current => current.filter(line => line.id !== id));

  // Barcode scanners type the code and press Enter: add the exact match straight to the cart.
  const scan = () => {
    const code = search.trim();
    if (!code) return;
    const match = products.find(p => p.barcode === code);
    if (match) {
      add(match);
      setSearch("");
    }
  };

  const totals = calculateSaleTotal(
    cart.map(line => ({ productId: line.id, quantity: line.quantity, unitPrice: line.selling_price, unitCost: line.cost_price })),
    Number(discount) || 0,
  );
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const received = Number(cashReceived);
  const changeDue = payment === "cash" && cashReceived !== "" ? Math.max(0, received - totals.total) : null;
  const shortBy = payment === "cash" && cashReceived !== "" && received < totals.total ? totals.total - received : 0;

  const resetSale = () => {
    setCart([]);
    setDiscount("0");
    setCashReceived("");
    setCustomerId("");
  };

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
    const saleValidationErrors = validateSaleInput(input);
    if (saleValidationErrors.length > 0) {
      onError(saleValidationErrors.join(". "));
      return;
    }

    setCharging(true);
    try {
      if (!navigator.onLine) {
        if (isTauri()) {
          await queueDesktopSale({ ...input, id, shopId: shop.id });
          onNotice("Sale queued for desktop synchronization when online.");
          resetSale();
          return;
        } else {
          onError("Offline sales checkout is only supported in the desktop app. Please reconnect to complete your purchase.");
          return;
        }
      }
      const { error } = await supabase.rpc("create_sale", {
        p_shop_id: shop.id,
        p_cashier_id: userId,
        p_customer_id: customerId || null,
        p_payment_method: payment,
        p_discount: totals.discount,
        p_lines: cart.map(line => ({ product_id: line.id, quantity: line.quantity })),
      });
      if (error) throw error;
      onNotice(`Sale completed: ${formatCurrency(totals.total)}${changeDue ? ` · change ${formatCurrency(changeDue)}` : ""}`);
      resetSale();
      await load();
    } catch (error) { fail(onError, error); }
    finally { setCharging(false); }
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="grid gap-6">
        <section aria-label="Products" className="grid gap-4">
          <SearchInput
            id="search-products"
            label="Search products by name or barcode"
            placeholder="Search products, or scan a barcode…"
            value={search}
            onChange={setSearch}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); scan(); } }}
            inputClassName="h-12 text-[15px]"
          />

          {categories.length > 0 && (
            <div role="group" aria-label="Filter by category" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[{ id: "all", name: "All" }, ...categories].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={selectedCat === cat.id}
                  onClick={() => setSelectedCat(cat.id)}
                  className={cn(
                    "h-9 shrink-0 rounded-full border px-4 text-[13px] font-semibold",
                    selectedCat === cat.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card text-foreground hover:bg-accent",
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {filtered.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {filtered.map(product => {
                const qty = inCart.get(product.id) ?? 0;
                const cat = product.category_id ? categoryName.get(product.category_id) : null;
                const atLimit = qty >= product.stock;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => add(product)}
                    disabled={atLimit}
                    aria-label={`Add ${product.name}, ${formatCurrency(product.selling_price)}${qty ? `, ${qty} in cart` : ""}`}
                    className={cn(
                      "relative flex min-h-[112px] flex-col justify-between gap-2 rounded-xl border bg-card p-3.5 text-left shadow-xs hover:border-primary/60 hover:shadow-sm active:bg-accent disabled:opacity-60",
                      qty > 0 && "border-primary ring-1 ring-primary",
                    )}
                  >
                    {qty > 0 && (
                      <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground shadow-sm">
                        {qty}
                      </span>
                    )}
                    <div className="min-w-0">
                      {cat && <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{cat}</p>}
                      <p className="line-clamp-2 text-sm font-semibold leading-snug">{product.name}</p>
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <span className="text-base font-extrabold tracking-tight">{formatCurrency(product.selling_price)}</span>
                      <span className={cn("text-xs font-semibold", stockLevel(product.stock, shop.low_stock_threshold) === "low" ? "text-warning" : "text-muted-foreground")}>
                        {product.stock} left
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={PackageSearch}
                title={loaded ? "No products found" : "Loading products…"}
                description={loaded ? (search ? "Try a different name or barcode." : "Products in stock will appear here.") : undefined}
              />
            </Card>
          )}
        </section>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              Recent sales
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {recent.length > 0 ? (
              <ul className="divide-y">
                {recent.map(sale => (
                  <li key={sale.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{new Date(sale.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
                    </div>
                    <Badge variant="secondary">{paymentLabel(sale.payment_method)}</Badge>
                    <span className="w-28 text-right text-sm font-bold tabular-nums">{formatCurrency(sale.total)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pb-3 text-sm text-muted-foreground">No sales yet. Completed sales show up here.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <aside id="cart" aria-label="Current sale" className="scroll-mt-20 lg:sticky lg:top-24">
        <Card className="flex flex-col overflow-hidden lg:max-h-[calc(100vh-7.5rem)]">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              Current sale
              {itemCount > 0 && <Badge variant="default">{itemCount}</Badge>}
            </CardTitle>
            {cart.length > 0 && (
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={resetSale}>
                Clear
              </Button>
            )}
          </CardHeader>

          <div className="min-h-[96px] flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="Cart is empty"
                description="Tap a product to add it, or scan a barcode."
                className="py-8"
              />
            ) : (
              <ul className="divide-y">
                {cart.map(item => (
                  <li key={item.id} className="grid gap-2 px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(item.selling_price)} each</p>
                      </div>
                      <p className="text-sm font-bold tabular-nums">{formatCurrency(item.selling_price * item.quantity)}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Decrease quantity of ${item.name}`}
                          onClick={() => item.quantity <= 1 ? removeLine(item.id) : setQuantity(item.id, item.quantity - 1, item.stock)}
                        >
                          <Minus />
                        </Button>
                        <Input
                          aria-label={`Quantity for ${item.name}`}
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max={item.stock}
                          value={item.quantity}
                          onChange={e => updateQuantity(item.id, e.target.value, item.stock)}
                          className="h-8 w-12 px-1 text-center font-semibold tabular-nums"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Increase quantity of ${item.name}`}
                          disabled={item.quantity >= item.stock}
                          onClick={() => setQuantity(item.id, item.quantity + 1, item.stock)}
                        >
                          <Plus />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${item.name} from cart`}
                        onClick={() => removeLine(item.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid shrink-0 gap-3 border-t bg-muted/40 p-4">
            <Field label="Customer" hint={selectedCustomer && shop.loyalty_enabled ? `Earns ${loyaltyPointsFor(totals.total, { loyaltyEnabled: true, loyaltySpendPerPoint: shop.loyalty_spend_per_point })} loyalty points · ${selectedCustomer.loyalty_points} pts now` : undefined}>
              <MenuSelect
                value={customerId || WALK_IN}
                onValueChange={(value) => setCustomerId(value === WALK_IN ? "" : value)}
                options={[{ value: WALK_IN, label: "Walk-in customer" }, ...customers.map(c => ({ value: c.id, label: c.name }))]}
              />
            </Field>

            <div className={cn("grid gap-3", payment === "cash" && "sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2")}>
              <Field label="Discount" htmlFor="sale-discount">
                <MoneyInput id="sale-discount" value={discount} onChange={setDiscount} />
              </Field>
              {payment === "cash" && (
                <Field label="Cash received" htmlFor="sale-cash">
                  <MoneyInput id="sale-cash" value={cashReceived} onChange={setCashReceived} placeholder="0.00" />
                </Field>
              )}
            </div>

            <Field label="Payment">
              <SegmentedControl
                aria-label="Payment method"
                size="lg"
                fullWidth
                value={payment}
                onValueChange={setPayment}
                options={(Object.keys(PAYMENT_METHODS) as PaymentMethodValue[]).map(method => {
                  const { short, icon: Icon } = PAYMENT_METHODS[method];
                  return { value: method, label: short, icon: <Icon /> };
                })}
              />
            </Field>

            <dl className="grid gap-1.5 border-t pt-3.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatCurrency(totals.subtotal)}</dd>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Discount</dt>
                  <dd className="tabular-nums">−{formatCurrency(totals.discount)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-1">
                <dt className="font-semibold">Total</dt>
                <dd className="text-2xl font-extrabold tracking-tight tabular-nums">{formatCurrency(totals.total)}</dd>
              </div>
              {changeDue !== null && shortBy === 0 && (
                <div className="flex justify-between font-semibold text-success">
                  <dt>Change due</dt>
                  <dd className="tabular-nums">{formatCurrency(changeDue)}</dd>
                </div>
              )}
              {shortBy > 0 && (
                <div className="flex justify-between font-semibold text-warning">
                  <dt>Still to collect</dt>
                  <dd className="tabular-nums">{formatCurrency(shortBy)}</dd>
                </div>
              )}
            </dl>

            <Button size="xl" className="w-full" disabled={cart.length === 0 || charging} onClick={() => void checkout()}>
              <Check />
              {charging ? "Processing…" : cart.length ? `Charge ${formatCurrency(totals.total)}` : "Charge"}
            </Button>
          </div>
        </Card>
      </aside>

      {cart.length > 0 && (
        <a
          href="#cart"
          className="fixed inset-x-3 bottom-[4.75rem] z-30 flex items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3.5 text-primary-foreground shadow-lg lg:hidden"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="h-4 w-4" />
            {itemCount} {itemCount === 1 ? "item" : "items"} · View sale
          </span>
          <span className="text-base font-extrabold tabular-nums">{formatCurrency(totals.total)}</span>
        </a>
      )}
    </div>
  );
}
