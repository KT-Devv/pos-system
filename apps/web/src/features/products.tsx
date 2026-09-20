"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  formatCurrency,
  Input,
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
import { FolderPlus, Info, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import {
  type Category,
  type Client,
  Field,
  type Feedback,
  fail,
  MenuSelect,
  MoneyInput,
  type Product,
  SearchInput,
  StockBadge,
} from "./common";

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

  const load = useCallback(async () => {
    const [{ data: prodRows, error: prodError }, { data: catRows, error: catError }] = await Promise.all([
      supabase.from("products").select("id,name,category_id,cost_price,selling_price,stock,barcode,categories(name)").order("name"),
      supabase.from("categories").select("id,name").order("name"),
    ]);
    if (prodError) fail(onError, prodError); else setProducts((prodRows ?? []) as unknown as Product[]);
    if (catError) fail(onError, catError); else setCategories((catRows ?? []) as Category[]);
    setLoaded(true);
  }, [supabase, onError]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
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
    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    if (error) { fail(onError, error); return; }
    setFormOpen(false);
    onNotice(editing ? "Product updated." : "Product added.");
    await load();
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
                    </TableCell>
                    {isAdmin && <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">{formatCurrency(product.cost_price)}</TableCell>}
                    <TableCell className="text-right font-bold tabular-nums">{formatCurrency(product.selling_price)}</TableCell>
                    {isAdmin && <TableCell className="hidden text-right tabular-nums text-muted-foreground lg:table-cell">{margin(product)}</TableCell>}
                    <TableCell><StockBadge stock={product.stock} threshold={lowAt} /></TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the details below." : "Create a product with its pricing and opening stock."}
            </DialogDescription>
          </DialogHeader>
          <form id="product-form" onSubmit={saveProduct} className="grid gap-4 sm:grid-cols-2">
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
            <Field label="Barcode" htmlFor="product-barcode" hint="Optional. Scan or type it.">
              <Input id="product-barcode" className="font-mono" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
            </Field>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" form="product-form">{editing ? "Save changes" : "Add product"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
