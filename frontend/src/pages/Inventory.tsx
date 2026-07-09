import { useState } from "react";
import { Plus, Search, ArrowDownCircle, ArrowUpCircle, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";

interface StockEntry {
  id: string;
  product_name: string;
  type: "in" | "out" | "adjustment";
  quantity: number;
  supplier: string;
  notes: string;
  date: string;
}

const mockStock: StockEntry[] = [
  { id: "1", product_name: "Milk", type: "in", quantity: 50, supplier: "Fresh Dairy Ltd", notes: "Weekly restock", date: "2024-01-15T10:30:00" },
  { id: "2", product_name: "Bread", type: "in", quantity: 30, supplier: "Golden Bakery", notes: "Morning delivery", date: "2024-01-15T08:00:00" },
  { id: "3", product_name: "Rice (5kg)", type: "out", quantity: 5, supplier: "", notes: "Sold to customer", date: "2024-01-14T16:45:00" },
  { id: "4", product_name: "Cooking Oil", type: "adjustment", quantity: -2, supplier: "", notes: "Damaged items", date: "2024-01-14T14:20:00" },
  { id: "5", product_name: "Water", type: "in", quantity: 100, supplier: "Aqua Pure", notes: "Bulk order", date: "2024-01-13T11:00:00" },
];

const suppliers = ["Fresh Dairy Ltd", "Golden Bakery", "Aqua Pure", "Agro Supplies", "General Mart"];

export default function Inventory() {
  const [stock, setStock] = useState<StockEntry[]>(mockStock);
  const [search, setSearch] = useState("");
  const [isStockInDialogOpen, setIsStockInDialogOpen] = useState(false);
  const [newStockEntry, setNewStockEntry] = useState({
    product_name: "",
    type: "in" as "in" | "out" | "adjustment",
    quantity: 0,
    supplier: "",
    notes: "",
  });

  const filteredStock = stock.filter((entry) =>
    entry.product_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleStockEntry = () => {
    if (newStockEntry.product_name && newStockEntry.quantity > 0) {
      setStock([
        {
          ...newStockEntry,
          id: String(stock.length + 1),
          date: new Date().toISOString(),
        },
        ...stock,
      ]);
      setNewStockEntry({
        product_name: "",
        type: "in",
        quantity: 0,
        supplier: "",
        notes: "",
      });
      setIsStockInDialogOpen(false);
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">8</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Out of Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">2</div>
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
                    <h4 className="font-medium">{entry.product_name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {entry.notes}
                      {entry.supplier && ` • ${entry.supplier}`}
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
                    {entry.quantity}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDateTime(entry.date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stock Entry Dialog */}
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
              <Label>Product Name</Label>
              <Input
                value={newStockEntry.product_name}
                onChange={(e) =>
                  setNewStockEntry({ ...newStockEntry, product_name: e.target.value })
                }
                placeholder="Enter product name"
              />
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
                value={newStockEntry.supplier}
                onValueChange={(value) =>
                  setNewStockEntry({ ...newStockEntry, supplier: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier} value={supplier}>
                      {supplier}
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
            <Button onClick={handleStockEntry}>Save Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
