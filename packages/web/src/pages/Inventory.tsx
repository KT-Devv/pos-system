import { useState, useEffect } from "react";
import { Plus, Search, ArrowDownCircle, ArrowUpCircle, Edit, Trash2 } from "lucide-react";
import { Button } from "@pos/shared/components/button";
import { Input } from "@pos/shared/components/input";
import { Card, CardContent, CardHeader, CardTitle } from "@pos/shared/components/card";
import { Badge } from "@pos/shared/components/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@pos/shared/components/dialog";
import { Label } from "@pos/shared/components/label";
import { formatDateTime } from "@pos/shared/lib/utils";
import { useStockHistory, useSuppliers, useCreateStockEntry, useInventoryStats } from "../hooks/useInventory";
import { supabase } from "../lib/supabase";

interface ProductOption {
  id: string;
  name: string;
}

interface StockEntryRow {
  product_id: string;
  productSearch?: string;
  measurement_unit: string;
  pack_quantity: number;
  unit_cost: number;
}

export default function Inventory() {
  const { stockHistory, loading: historyLoading, refetch: refetchHistory } = useStockHistory();
  const { suppliers, refetch: refetchSuppliers } = useSuppliers();
  const { stats } = useInventoryStats();
  const { createStockEntry, creating, error: stockError } = useCreateStockEntry();

  const [search, setSearch] = useState("");
  const [isStockInDialogOpen, setIsStockInDialogOpen] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [stockEntries, setStockEntries] = useState<StockEntryRow[]>([
    { product_id: "", productSearch: "", measurement_unit: "", pack_quantity: 0, unit_cost: 0 },
  ]);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name")
        .order("name");
      setProducts(data || []);
    };
    fetchProducts();
  }, []);

  const filteredStock = stockHistory.filter((entry) =>
    entry.products?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const updateStockEntry = (index: number, updates: Partial<StockEntryRow>) => {
    setStockEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...updates } : entry)));
  };

  const addStockEntryRow = () => {
    setStockEntries((prev) => [...prev, { product_id: "", productSearch: "", measurement_unit: "", pack_quantity: 0, unit_cost: 0 }]);
  };

  const removeStockEntryRow = (index: number) => {
    setStockEntries((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const handleStockEntry = async () => {
    const validRows = stockEntries.filter((row) => row.product_id && row.pack_quantity > 0 && row.unit_cost >= 0);
    if (validRows.length === 0) {
      alert("Please ensure all rows have a valid product selected and quantity > 0");
      return;
    }

    let finalSupplierId = supplierId;
    if (!finalSupplierId && supplierSearch) {
      try {
        const { data, error } = await supabase.from('suppliers').insert({ name: supplierSearch }).select().single();
        if (data && !error) {
          finalSupplierId = data.id;
        }
      } catch (err) {
        console.error("Failed to create supplier:", err);
      }
    }

    let success = true;
    for (const row of validRows) {
      const ok = await createStockEntry({
        product_id: row.product_id,
        type: "in",
        quantity: Math.abs(row.pack_quantity),
        supplier_id: finalSupplierId || null,
        notes: notes || null,
        measurement_unit: row.measurement_unit || null,
        pack_quantity: row.pack_quantity,
        unit_cost: row.unit_cost,
      });
      if (!ok) {
        success = false;
        break;
      }
    }

    if (success) {
      setStockEntries([{ product_id: "", productSearch: "", measurement_unit: "", pack_quantity: 0, unit_cost: 0 }]);
      setSupplierId("");
      setSupplierSearch("");
      setNotes("");
      setIsStockInDialogOpen(false);
      refetchHistory();
      refetchSuppliers();
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">Track stock movements and manage inventory</p>
        </div>
        <Button onClick={() => setIsStockInDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Stock Entry
        </Button>
      </div>

      {stockError && <p className="text-red-500 mb-4">{stockError}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.lowStock}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Out of Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.outOfStock}</div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search stock history..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock History</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : filteredStock.length === 0 ? (
            <p className="text-muted-foreground">No stock history found</p>
          ) : (
            <div className="space-y-4">
              {filteredStock.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${
                      entry.type === "in"
                        ? "bg-green-100"
                        : entry.type === "out"
                        ? "bg-red-100"
                        : "bg-yellow-100"
                    }`}>
                      {entry.type === "in" ? (
                        <ArrowDownCircle className="h-5 w-5 text-green-600" />
                      ) : entry.type === "out" ? (
                        <ArrowUpCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <Edit className="h-5 w-5 text-yellow-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium">{entry.products?.name || "Unknown"}</h4>
                      <p className="text-sm text-muted-foreground">
                        {entry.notes}
                        {entry.suppliers?.name && ` • ${entry.suppliers.name}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        entry.type === "in"
                          ? "success"
                          : entry.type === "out"
                          ? "destructive"
                          : "warning"
                      }
                    >
                      {entry.type === "in" ? "+" : entry.type === "out" ? "-" : "±"}
                      {Math.abs(entry.quantity)}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateTime(entry.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isStockInDialogOpen} onOpenChange={setIsStockInDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bulk Stock Entry</DialogTitle>
            <DialogDescription>
              Record purchased stock in bulk with product details, measure, pack quantity, and unit cost.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Distributor</Label>
              <Input
                list="suppliers-list"
                value={supplierSearch || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  const matched = suppliers.find(s => s.name === val);
                  setSupplierSearch(val);
                  setSupplierId(matched ? matched.id : "");
                }}
                placeholder="Type to search or add new distributor..."
              />
              <datalist id="suppliers-list">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>

            <div className="space-y-3">
              {stockEntries.map((entry, index) => (
                <div key={index} className="rounded-lg border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Item {index + 1}</p>
                    {stockEntries.length > 1 && (
                      <button type="button" onClick={() => removeStockEntryRow(index)} className="text-sm text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Product name</Label>
                      <Input
                        list="products-list"
                        value={entry.productSearch || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const matched = products.find(p => p.name === val);
                          updateStockEntry(index, { productSearch: val, product_id: matched ? matched.id : "" });
                        }}
                        placeholder="Type to search products..."
                      />
                      <datalist id="products-list">
                        {products.map((p) => (
                          <option key={p.id} value={p.name} />
                        ))}
                      </datalist>
                    </div>

                    <div className="grid gap-2">
                      <Label>Quantity / Measure</Label>
                      <Input
                        value={entry.measurement_unit}
                        onChange={(e) => updateStockEntry(index, { measurement_unit: e.target.value })}
                        placeholder="e.g. 500g"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>Quantity in box</Label>
                      <Input
                        type="number"
                        value={entry.pack_quantity || ""}
                        onChange={(e) => updateStockEntry(index, { pack_quantity: Number(e.target.value) })}
                        placeholder="e.g. 60"
                      />
                    </div>

                    <div className="grid gap-2 md:col-span-2">
                      <Label>Unit cost price (Ghc)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={entry.unit_cost || ""}
                        onChange={(e) => updateStockEntry(index, { unit_cost: Number(e.target.value) })}
                        placeholder="e.g. 4.50"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" onClick={addStockEntryRow}>
                <Plus className="h-4 w-4 mr-2" />
                Add another item
              </Button>
            </div>

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStockInDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStockEntry} disabled={creating}>
              {creating ? "Saving..." : "Save Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
