"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
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
  describeStock,
  EmptyState,
  formatCurrency,
  Input,
  packLabel,
  PageHeader,
  SegmentedControl,
  stockLevel,
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
import { useWorkspace } from "@/lib/workspace";
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, PackageSearch, Plus, SlidersHorizontal, Truck } from "lucide-react";
import {
  type Client,
  Field,
  type Feedback,
  fail,
  loadPackSizes,
  MenuSelect,
  type PackSizeRow,
  type Product,
  SearchInput,
  StockBadge,
  type Supplier,
} from "./common";

type MovementType = "in" | "out" | "adjustment";
type LevelFilter = "all" | "low" | "out";

const emptySupplier = { name: "", phone: "", email: "", address: "" };

const TYPE_COPY: Record<MovementType, { quantity: string; hint: string; submit: string }> = {
  in: { quantity: "Quantity received", hint: "Adds to the stock on hand.", submit: "Record stock in" },
  out: { quantity: "Quantity removed", hint: "Removes from stock (damage, samples, transfers).", submit: "Record stock out" },
  adjustment: { quantity: "Counted stock", hint: "Sets the stock on hand to exactly this number.", submit: "Save adjustment" },
};

export function Inventory({ supabase, onError, onNotice }: { supabase: Client } & Feedback) {
  const { shop } = useWorkspace();
  const lowAt = shop.low_stock_threshold;
  const [activeTab, setActiveTab] = useState<"movements" | "suppliers">("movements");
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [productId, setProductId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [type, setType] = useState<MovementType>("in");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [packs, setPacks] = useState<Map<string, PackSizeRow[]>>(new Map());
  /** What the quantity is counted in: "" for single items, or a pack size's id. */
  const [unitId, setUnitId] = useState("");

  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [search, setSearch] = useState("");

  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState(emptySupplier);

  const load = useCallback(async () => {
    const [{ data: prodData, error: prodError }, { data: suppData, error: suppError }, packRes] = await Promise.all([
      supabase.from("products").select("id,name,cost_price,selling_price,stock,barcode").order("name"),
      supabase.from("suppliers").select("id,name,phone,email,address").order("name"),
      loadPackSizes(supabase),
    ]);
    if (prodError) fail(onError, prodError); else setProducts((prodData ?? []) as Product[]);
    if (suppError) fail(onError, suppError); else setSuppliers((suppData ?? []) as Supplier[]);
    if (packRes.error) fail(onError, packRes.error); else setPacks(packRes.data);
    setLoaded(true);
  }, [supabase, onError]);

  useEffect(() => { void load(); }, [load]);

  const selected = products.find(p => p.id === productId);
  const selectedPacks = selected ? packs.get(selected.id) ?? [] : [];
  const unit = selectedPacks.find(pack => pack.id === unitId) ?? null;
  const amount = Number(quantity);
  // A recount may legitimately be zero; receiving or removing stock must be at least one.
  const minAmount = type === "adjustment" ? 0 : 1;
  const validAmount = quantity.trim() !== "" && Number.isInteger(amount) && amount >= minAmount;
  // Stock is kept in single items, so a count of packs is turned into items before it is saved.
  const items = validAmount ? amount * (unit?.quantity ?? 1) : 0;

  // What the stock on hand becomes after this movement, for the preview line.
  const after = !selected || !validAmount
    ? null
    : type === "in" ? selected.stock + items
    : type === "out" ? selected.stock - items
    : items;

  const saveMovement = async (event: FormEvent) => {
    event.preventDefault();
    if (!productId || !validAmount) {
      onError(type === "adjustment" ? "Select a product and enter the counted stock as a whole number (zero or more)." : "Select a product and enter a positive whole-number quantity.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("record_stock_movement", {
      p_product_id: productId,
      p_type: type,
      p_quantity: items,
      p_supplier_id: type === "in" ? supplierId || null : null,
      p_notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) { fail(onError, error); return; }
    onNotice("Stock movement recorded.");
    setQuantity("");
    setNotes("");
    setSupplierId("");
    await load();
  };

  const addSupplier = async (event: FormEvent) => {
    event.preventDefault();
    if (!supplierForm.name.trim()) { onError("Supplier name is required."); return; }
    const { error } = await supabase.from("suppliers").insert({
      shop_id: shop.id,
      name: supplierForm.name.trim(),
      phone: supplierForm.phone.trim() || null,
      email: supplierForm.email.trim() || null,
      address: supplierForm.address.trim() || null,
    });
    if (error) { fail(onError, error); return; }
    setSupplierForm(emptySupplier);
    setSupplierOpen(false);
    onNotice("Supplier added.");
    await load();
  };

  const restock = (product: Product) => {
    setProductId(product.id);
    setUnitId("");
    setType("in");
    window.setTimeout(() => document.getElementById("movement-qty")?.focus(), 0);
  };

  const levels = useMemo(() => products.filter(p => {
    const matchFilter = levelFilter === "all" || stockLevel(p.stock, lowAt) === (levelFilter === "out" ? "out" : "low");
    return matchFilter && `${p.name} ${p.barcode ?? ""}`.toLowerCase().includes(search.toLowerCase());
  }), [products, levelFilter, search, lowAt]);

  const unitsOnHand = products.reduce((sum, p) => sum + p.stock, 0);
  const valuation = products.reduce((sum, p) => sum + p.stock * p.cost_price, 0);
  const copy = TYPE_COPY[type];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Inventory"
        description={loaded ? `${unitsOnHand.toLocaleString()} units on hand · valued at ${formatCurrency(valuation)} at cost` : "Record stock movements and manage your suppliers."}
        actions={activeTab === "suppliers" && (
          <Button onClick={() => setSupplierOpen(true)}>
            <Plus />
            Add supplier
          </Button>
        )}
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="movements">Stock</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers ({suppliers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="movements">
          <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
            <Card className="lg:sticky lg:top-24">
              <CardHeader>
                <CardTitle>Record movement</CardTitle>
                <CardDescription>Log stock arriving, leaving, or a recount.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveMovement} className="grid gap-4">
                  <SegmentedControl
                    aria-label="Movement type"
                    fullWidth
                    value={type}
                    onValueChange={setType}
                    options={[
                      { value: "in", label: "Stock in", icon: <ArrowDownToLine /> },
                      { value: "out", label: "Stock out", icon: <ArrowUpFromLine /> },
                      { value: "adjustment", label: "Recount", icon: <SlidersHorizontal /> },
                    ]}
                  />
                  <Field label="Product">
                    <MenuSelect
                      value={productId}
                      placeholder="Choose a product"
                      onValueChange={value => { setProductId(value); setUnitId(""); }}
                      options={products.map(product => ({ value: product.id, label: `${product.name} (${product.stock} on hand)` }))}
                    />
                  </Field>
                  {selectedPacks.length > 0 && (
                    <Field label="Counting in" hint="Stock is kept in single items. Counting in packs multiplies for you.">
                      <MenuSelect
                        value={unitId}
                        onValueChange={setUnitId}
                        options={[
                          { value: "", label: "Single items" },
                          ...selectedPacks.map(pack => ({ value: pack.id, label: `${packLabel(pack.name, pack.quantity)} (${pack.quantity} items)` })),
                        ]}
                      />
                    </Field>
                  )}
                  <Field
                    label={unit ? `${copy.quantity} (${unit.name.toLowerCase()}s)` : copy.quantity}
                    htmlFor="movement-qty"
                    hint={unit && validAmount ? `${amount} × ${unit.quantity} = ${items} single items. ${copy.hint}` : copy.hint}
                  >
                    <Input id="movement-qty" required type="number" inputMode="numeric" min={minAmount} step="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
                  </Field>

                  {selected && after !== null && (
                    <div
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-semibold",
                        after < 0 ? "bg-destructive-soft text-destructive" : "bg-accent text-accent-foreground",
                      )}
                    >
                      <span>{selected.name}</span>
                      <span className="flex items-center gap-2 tabular-nums">
                        {selected.stock}
                        <ArrowRight className="h-4 w-4" />
                        {after}
                      </span>
                    </div>
                  )}

                  {type === "in" && (
                    <Field label="Supplier (optional)">
                      <MenuSelect
                        value={supplierId}
                        onValueChange={setSupplierId}
                        options={[{ value: "", label: "None" }, ...suppliers.map(sup => ({ value: sup.id, label: sup.name }))]}
                      />
                    </Field>
                  )}
                  <Field label="Notes" htmlFor="movement-notes">
                    <Textarea id="movement-notes" rows={2} className="min-h-[64px]" value={notes} onChange={e => setNotes(e.target.value)} />
                  </Field>
                  <Button type="submit" size="lg" disabled={saving || (after !== null && after < 0)}>
                    {saving ? "Saving…" : copy.submit}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
                <SearchInput label="Search stock" placeholder="Search products…" value={search} onChange={setSearch} className="flex-1" />
                <SegmentedControl
                  aria-label="Filter stock levels"
                  value={levelFilter}
                  onValueChange={setLevelFilter}
                  options={[
                    { value: "all", label: "All" },
                    { value: "low", label: "Low" },
                    { value: "out", label: "Out" },
                  ]}
                />
              </div>
              <CardContent className="p-0">
                {levels.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead className="hidden text-right md:table-cell">Unit cost</TableHead>
                        <TableHead className="hidden text-right sm:table-cell">Value</TableHead>
                        <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {levels.map(product => (
                        <TableRow key={product.id}>
                          <TableCell className="font-semibold">{product.name}</TableCell>
                          <TableCell>
                            <StockBadge stock={product.stock} threshold={lowAt} />
                            {describeStock(product.stock, packs.get(product.id) ?? []) && (
                              <p className="mt-1 text-xs text-muted-foreground">{describeStock(product.stock, packs.get(product.id) ?? [])}</p>
                            )}
                          </TableCell>
                          <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">{formatCurrency(product.cost_price)}</TableCell>
                          <TableCell className="hidden text-right font-semibold tabular-nums sm:table-cell">{formatCurrency(product.stock * product.cost_price)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => restock(product)}>Restock</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState
                    icon={PackageSearch}
                    title={!loaded ? "Loading stock…" : products.length === 0 ? "No products yet" : "Nothing matches"}
                    description={!loaded ? undefined : products.length === 0 ? "Add products first, then track their stock here." : "Try a different search or filter."}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardContent className="p-0">
              {suppliers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead className="hidden lg:table-cell">Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map(sup => (
                      <TableRow key={sup.id}>
                        <TableCell className="font-semibold">{sup.name}</TableCell>
                        <TableCell className="text-muted-foreground">{sup.phone || "—"}</TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{sup.email || "—"}</TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">{sup.address || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  icon={Truck}
                  title={loaded ? "No suppliers yet" : "Loading suppliers…"}
                  description={loaded ? "Add the companies you buy stock from." : undefined}
                  action={loaded ? <Button onClick={() => setSupplierOpen(true)}><Plus />Add supplier</Button> : undefined}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add supplier</DialogTitle>
            <DialogDescription>Register a company or contact you buy from.</DialogDescription>
          </DialogHeader>
          <form id="supplier-form" onSubmit={addSupplier} className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier name" htmlFor="supplier-name" className="sm:col-span-2">
              <Input id="supplier-name" required value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} />
            </Field>
            <Field label="Phone" htmlFor="supplier-phone">
              <Input id="supplier-phone" type="tel" value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
            </Field>
            <Field label="Email" htmlFor="supplier-email">
              <Input id="supplier-email" type="email" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} />
            </Field>
            <Field label="Address" htmlFor="supplier-address" className="sm:col-span-2">
              <Input id="supplier-address" value={supplierForm.address} onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })} />
            </Field>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSupplierOpen(false)}>Cancel</Button>
            <Button type="submit" form="supplier-form">Add supplier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
