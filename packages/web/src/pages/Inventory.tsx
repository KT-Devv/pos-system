import { useState, useEffect } from "react";
import { Plus, Search, ArrowDownCircle, ArrowUpCircle, Edit } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pos/shared/components/select";
import { formatDateTime } from "@pos/shared/lib/utils";
import { useStockHistory, useSuppliers, useCreateStockEntry, useInventoryStats } from "../hooks/useInventory";
import { supabase } from "../lib/supabase";

interface ProductOption {
  id: string;
  name: string;
}

export default function Inventory() {
  const { stockHistory, loading: historyLoading, refetch: refetchHistory } = useStockHistory();
  const { suppliers } = useSuppliers();
  const { stats } = useInventoryStats();
  const { createStockEntry, creating, error: stockError } = useCreateStockEntry();

  const [search, setSearch] = useState("");
  const [isStockInDialogOpen, setIsStockInDialogOpen] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [newStockEntry, setNewStockEntry] = useState({
    product_id: "",
    type: "in" as "in" | "out" | "adjustment",
    quantity: 0,
    supplier_id: "",
    notes: "",
  });

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

  const handleStockEntry = async () => {
    const qty = newStockEntry.quantity;
    if (!newStockEntry.product_id || qty === 0) return;
    if (newStockEntry.type !== "adjustment" && qty <= 0) return;

    const ok = await createStockEntry({
      product_id: newStockEntry.product_id,
      type: newStockEntry.type,
      quantity: Math.abs(qty),
      supplier_id: newStockEntry.supplier_id || null,
      notes: newStockEntry.notes || null,
    });
    if (ok) {
      setNewStockEntry({ product_id: "", type: "in", quantity: 0, supplier_id: "", notes: "" });
      setIsStockInDialogOpen(false);
      refetchHistory();
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stock Entry</DialogTitle>
            <DialogDescription>
              Record a new stock movement.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Product</Label>
              <Select
                value={newStockEntry.product_id}
                onValueChange={(value) =>
                  setNewStockEntry({ ...newStockEntry, product_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={newStockEntry.type}
                onValueChange={(value: "in" | "out" | "adjustment") =>
                  setNewStockEntry({ ...newStockEntry, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Stock In</SelectItem>
                  <SelectItem value="out">Stock Out</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={newStockEntry.quantity || ""}
                onChange={(e) =>
                  setNewStockEntry({ ...newStockEntry, quantity: Number(e.target.value) })
                }
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label>Supplier</Label>
              <Select
                value={newStockEntry.supplier_id}
                onValueChange={(value) =>
                  setNewStockEntry({ ...newStockEntry, supplier_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input
                value={newStockEntry.notes}
                onChange={(e) =>
                  setNewStockEntry({ ...newStockEntry, notes: e.target.value })
                }
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
