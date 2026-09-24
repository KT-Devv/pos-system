"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  barcodeFromScan,
  barcodesMatch,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  describeStock,
  EmptyState,
  formatCurrency,
  generateInternalBarcode,
  Input,
  packLabel,
  PageHeader,
  stockLevel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  validateProductInput,
} from "@pos/shared";
import { Camera, FolderPlus, Info, Package, Pencil, Plus, ScanBarcode, Trash2, WandSparkles } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import {
  type Category,
  type Client,
  Field,
  type Feedback,
  fail,
  loadPackSizes,
  MenuSelect,
  MoneyInput,
  type PackSizeRow,
  type Product,
  SearchInput,
  StockBadge,
} from "./common";
import { BarcodeLabelDialog } from "./barcode-label";
import { BarcodeScannerDialog, type ScanResult } from "./scanner";
import { draftErrors, draftsFrom, type PackDraft, PackSizesEditor, savePackSizes } from "./pack-sizes";

const emptyForm = { name: "", category_id: "", cost: "", price: "", stock: "", barcode: "" };

function margin(product: Product) {
  if (!product.selling_price) return "—";
  return `${Math.round(((product.selling_price - product.cost_price) / product.selling_price) * 100)}%`;
}

export function Products({ supabase, isAdmin, onError, onNotice }: { supabase: Client; isAdmin: boolean } & Feedback) {
  const { shop } = useWorkspace();
  const lowAt = shop.low_stock_threshold;
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [labelFor, setLabelFor] = useState<Product | null>(null);
  const [scanning, setScanning] = useState(false);
  const [packs, setPacks] = useState<Map<string, PackSizeRow[]>>(new Map());
  const [drafts, setDrafts] = useState<PackDraft[]>([]);

  const load = useCallback(async () => {
    const [{ data: prodRows, error: prodError }, { data: catRows, error: catError }, packRes] = await Promise.all([
      supabase.from("products").select("id,name,category_id,cost_price,selling_price,stock,barcode,categories(name)").order("name"),
      supabase.from("categories").select("id,name").order("name"),
      loadPackSizes(supabase),
    ]);
    if (prodError) fail(onError, prodError); else setProducts((prodRows ?? []) as unknown as Product[]);
    if (catError) fail(onError, catError); else setCategories((catRows ?? []) as Category[]);
    if (packRes.error) fail(onError, packRes.error); else setPacks(packRes.data);
    setLoaded(true);
  }, [supabase, onError]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDrafts([]);
    setFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      category_id: product.category_id ?? "",
      cost: String(product.cost_price),
      price: String(product.selling_price),
      stock: String(product.stock),
      barcode: product.barcode ?? "",
    });
    setDrafts(draftsFrom(packs.get(product.id) ?? []));
    setFormOpen(true);
  };

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      shop_id: shop.id,
      name: form.name.trim(),
      category_id: form.category_id || null,
      cost_price: Number(form.cost),
      selling_price: Number(form.price),
      stock: Number(form.stock || 0),
      barcode: form.barcode.trim() || null,
    };
    const validationErrors = validateProductInput({
      name: payload.name,
      costPrice: payload.cost_price,
      sellingPrice: payload.selling_price,
      stock: payload.stock,
    });
    if (validationErrors.length > 0) {
      onError(validationErrors.join(". "));
      return;
    }
    // Codes that are already taken: this product's own barcode, and every other product's and pack size's.
    const taken = [
      ...(payload.barcode ? [{ code: payload.barcode, owner: "this product" }] : []),
      ...products.filter(p => p.id !== editing?.id && p.barcode).map(p => ({ code: p.barcode as string, owner: p.name })),
      ...[...packs.entries()].filter(([productId]) => productId !== editing?.id)
        .flatMap(([productId, rows]) => rows.filter(row => row.barcode).map(row => ({ code: row.barcode as string, owner: `${products.find(p => p.id === productId)?.name ?? "another product"} (${row.name})` }))),
    ];
    const packProblems = draftErrors(drafts, taken);
    if (packProblems.length > 0) {
      onError(packProblems.join(". "));
      return;
    }

    let productId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) { fail(onError, error); return; }
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select("id").single();
      if (error) { fail(onError, error); return; }
      productId = (data as { id: string }).id;
    }
    const packError = productId ? await savePackSizes(supabase, shop.id, productId, packs.get(productId) ?? [], drafts) : null;
    setFormOpen(false);
    await load();
    if (packError) {
      fail(onError, new Error(`The product was saved, but its pack sizes were not: ${packError.message}. Edit the product to try again.`));
      return;
    }
    onNotice(editing ? "Product updated." : "Product added.");
  };

  /** A scanned code goes into the form, unless another product already uses it. A QR link is stored as the barcode inside it. */
  const captureBarcode = (scanned: string): ScanResult => {
    const code = barcodeFromScan(scanned);
    const owner = products.find(p => p.id !== editing?.id && p.barcode && barcodesMatch(code, p.barcode));
    if (owner) return { ok: false, message: `${owner.name} already uses that barcode.` };
    setForm(current => ({ ...current, barcode: code }));
    setScanning(false);
    return { ok: true, message: "Barcode captured." };
  };

  const addCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!newCatName.trim()) return;
    const { error } = await supabase.from("categories").insert({ shop_id: shop.id, name: newCatName.trim() });
    if (error) { fail(onError, error); return; }
    setNewCatName("");
    setCategoryOpen(false);
    onNotice("Category added.");
    await load();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("products").delete().eq("id", deleting.id);
    setDeleting(null);
    if (error) fail(onError, error);
    else { onNotice("Product deleted."); await load(); }
  };

  const filtered = useMemo(() => products.filter(p => {
    const matchCat = selectedCategory === "all" || p.category_id === selectedCategory;
    const matchSearch = `${p.name} ${p.barcode ?? ""}`.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [products, selectedCategory, search]);

  const lowCount = products.filter(p => stockLevel(p.stock, lowAt) === "low").length;
  const outCount = products.filter(p => p.stock <= 0).length;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Products"
        description={
          loaded
            ? `${products.length} ${products.length === 1 ? "product" : "products"}${lowCount ? ` · ${lowCount} low on stock` : ""}${outCount ? ` · ${outCount} out of stock` : ""}`
            : "Prices, barcodes, categories, and what's on the shelf."
        }
        actions={isAdmin && (
          <>
            <Button variant="outline" onClick={() => setCategoryOpen(true)}>
              <FolderPlus />
              New category
            </Button>
            <Button onClick={openCreate}>
              <Plus />
              Add product
            </Button>
          </>
        )}
      />

      {!isAdmin && (
        <Alert variant="info">
          <Info className="h-4 w-4" />
          <AlertDescription>Only admins can add, edit, or remove products. You can browse the catalog here.</AlertDescription>
        </Alert>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
          <SearchInput
            label="Search products"
            placeholder="Search by name or barcode…"
            value={search}
            onChange={setSearch}
            className="flex-1"
          />
          <MenuSelect
            className="sm:w-56"
            value={selectedCategory}
            onValueChange={setSelectedCategory}
            options={[{ value: "all", label: "All categories" }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
          />
        </div>
        <CardContent className="p-0">
          {filtered.length > 0 ? (
            <>
            <ul className="divide-y md:hidden">
              {filtered.map(product => {
                const productPacks = packs.get(product.id) ?? [];
                const stockNote = describeStock(product.stock, productPacks);
                return (
                  <li key={product.id} className="grid gap-2.5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.categories?.name || "Uncategorised"}
                          {product.barcode && <span className="font-mono"> · {product.barcode}</span>}
                        </p>
                      </div>
                      <p className="shrink-0 font-bold tabular-nums">{formatCurrency(product.selling_price)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <StockBadge stock={product.stock} threshold={lowAt} />
                      {stockNote && <span className="text-xs text-muted-foreground">{stockNote}</span>}
                    </div>
                    {productPacks.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {productPacks.map(pack => `${packLabel(pack.name, pack.quantity)} · ${formatCurrency(pack.selling_price)}`).join("  ·  ")}
                      </p>
                    )}
                    {isAdmin && (
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setLabelFor(product)} aria-label={`Print barcode label for ${product.name}`}>
                          <ScanBarcode />
                          Label
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(product)} aria-label={`Edit ${product.name}`}>
                          <Pencil />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 text-destructive" onClick={() => setDeleting(product)} aria-label={`Delete ${product.name}`}>
                          <Trash2 />
                          Delete
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
              <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  {isAdmin && <TableHead className="hidden text-right md:table-cell">Cost</TableHead>}
                  <TableHead className="text-right">Price</TableHead>
                  {isAdmin && <TableHead className="hidden text-right lg:table-cell">Margin</TableHead>}
                  <TableHead>Stock</TableHead>
                  {isAdmin && <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(product => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <p className="font-semibold">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.categories?.name || "Uncategorised"}
                        {product.barcode && <span className="hidden sm:inline"> · <span className="font-mono">{product.barcode}</span></span>}
                      </p>
                      {(packs.get(product.id) ?? []).length > 0 && (
                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          {(packs.get(product.id) ?? []).map(pack => (
                            <span key={pack.id}>{packLabel(pack.name, pack.quantity)} · {formatCurrency(pack.selling_price)}</span>
                          ))}
                        </p>
                      )}
                    </TableCell>
                    {isAdmin && <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">{formatCurrency(product.cost_price)}</TableCell>}
                    <TableCell className="text-right font-bold tabular-nums">{formatCurrency(product.selling_price)}</TableCell>
                    {isAdmin && <TableCell className="hidden text-right tabular-nums text-muted-foreground lg:table-cell">{margin(product)}</TableCell>}
                    <TableCell>
                      <StockBadge stock={product.stock} threshold={lowAt} />
                      {describeStock(product.stock, packs.get(product.id) ?? []) && (
                        <p className="mt-1 text-xs text-muted-foreground">{describeStock(product.stock, packs.get(product.id) ?? [])}</p>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Print barcode label for ${product.name}`}
                            title={product.barcode ? "Print barcode label" : "Print barcode label (add a barcode first)"}
                            onClick={() => setLabelFor(product)}
                          >
                            <ScanBarcode />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${product.name}`} title="Edit" onClick={() => openEdit(product)}>
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Delete ${product.name}`}
                            title="Delete"
                            onClick={() => setDeleting(product)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
              </div>
            </>
          ) : (
            <EmptyState
              icon={Package}
              title={!loaded ? "Loading products…" : products.length === 0 ? "No products yet" : "No matching products"}
              description={
                !loaded ? undefined
                : products.length === 0 ? (isAdmin ? "Add your first product to start selling." : "An admin needs to add products first.")
                : "Try a different search or category."
              }
              action={loaded && products.length === 0 && isAdmin ? <Button onClick={openCreate}><Plus />Add product</Button> : undefined}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the details below." : "Create a product with its pricing and opening stock."}
            </DialogDescription>
          </DialogHeader>
          <form id="product-form" onSubmit={saveProduct} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Product name" htmlFor="product-name" className="sm:col-span-2">
              <Input id="product-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Category" className="sm:col-span-2">
              <MenuSelect
                value={form.category_id}
                placeholder="No category"
                onValueChange={val => setForm({ ...form, category_id: val })}
                options={[{ value: "", label: "No category" }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
              />
            </Field>
            <Field label="Cost price" htmlFor="product-cost">
              <MoneyInput id="product-cost" required value={form.cost} onChange={v => setForm({ ...form, cost: v })} />
            </Field>
            <Field label="Selling price" htmlFor="product-price">
              <MoneyInput id="product-price" required min="0.01" value={form.price} onChange={v => setForm({ ...form, price: v })} />
            </Field>
            <Field label={editing ? "Stock on hand" : "Opening stock"} htmlFor="product-stock">
              <Input id="product-stock" type="number" inputMode="numeric" min="0" step="1" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
            </Field>
            <Field label="Barcode" htmlFor="product-barcode" hint="Optional. Scan a barcode or QR code, type it, or generate one for items without a barcode.">
              <div className="flex gap-2">
                <Input id="product-barcode" className="min-w-0 flex-1 font-mono" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
                <Button type="button" variant="outline" size="icon" aria-label="Scan barcode with the camera" title="Scan with the camera" onClick={() => setScanning(true)}>
                  <Camera />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Generate a barcode"
                  title="Generate a barcode"
                  onClick={() => setForm(current => ({ ...current, barcode: generateInternalBarcode(products.map(p => p.barcode)) }))}
                >
                  <WandSparkles />
                </Button>
              </div>
            </Field>
            <PackSizesEditor drafts={drafts} onChange={setDrafts} singlePrice={Number(form.price) || 0} />
          </form>
          {/* Pinned, so Save stays in reach however many pack sizes make the form tall. */}
          <DialogFooter className="sticky bottom-0 -mb-1 bg-card pb-1 pt-3">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" form="product-form">{editing ? "Save changes" : "Add product"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BarcodeScannerDialog
        open={scanning}
        onClose={() => setScanning(false)}
        onScan={captureBarcode}
        title="Scan the product's code"
        description="Point the camera at the barcode or QR code on the product."
        doneLabel="Cancel"
      />
      <BarcodeLabelDialog key={labelFor?.id} product={labelFor} onClose={() => setLabelFor(null)} />

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
            <DialogDescription>Categories group products on the sales screen.</DialogDescription>
          </DialogHeader>
          <form id="category-form" onSubmit={addCategory}>
            <Field label="Category name" htmlFor="new-category">
              <Input id="new-category" required value={newCatName} onChange={e => setNewCatName(e.target.value)} />
            </Field>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCategoryOpen(false)}>Cancel</Button>
            <Button type="submit" form="category-form">Add category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this product?</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{deleting?.name}</span> will be removed from the catalog.
              Products that already appear in past sales can&apos;t be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>Keep product</Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()}>
              <Trash2 />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
